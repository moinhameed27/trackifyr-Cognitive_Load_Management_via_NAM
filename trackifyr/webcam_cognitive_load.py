"""
Live cognitive load demo (v1 / v2 / v3) using the same feature pipelines as training.

  .venv\\Scripts\\python webcam_cognitive_load.py --version v2
  .venv\\Scripts\\python webcam_cognitive_load.py --version v3 --device cuda

Requires trained artifacts from train_daisee.py (defaults under artifacts/daisee/).
Press Q to quit.
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
import cv2
import joblib
import numpy as np
import torch

from ml.daisee_common import ARTIFACTS_DIR, LABEL_NAMES
from ml.features_v1 import NUM_SAMPLE_FRAMES, frame_mean_std, v1_vector_from_series
from ml.features_v2 import FaceMeshExtractor, V2Rolling
from ml.model_v3 import CognitiveLoadNet3, V3FrameBuffer, frame_to_tensor_v3, get_device


def smooth_label(history: deque, pred: int, window: int = 7) -> int:
    history.append(pred)
    if len(history) < 3:
        return pred
    return Counter(history).most_common(1)[0][0]


def run_v1(cap, model, args) -> None:
    means: list[float] = []
    stds: list[float] = []
    smooth_q: deque = deque(maxlen=args.smooth)
    fps_smooth = 30.0
    alpha = 0.9

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        m, s = frame_mean_std(frame)
        means.append(m)
        stds.append(s)
        means = means[-NUM_SAMPLE_FRAMES:]
        stds = stds[-NUM_SAMPLE_FRAMES:]
        vec = v1_vector_from_series(means, stds, fps=fps_smooth, n_frames_reported=float(len(means)))
        proba = model.predict_proba(vec.reshape(1, -1))[0]
        pred = int(np.argmax(proba))
        pred = smooth_label(smooth_q, pred)
        fps_smooth = alpha * fps_smooth + (1 - alpha) * (cap.get(cv2.CAP_PROP_FPS) or 30.0)

        label = LABEL_NAMES[pred]
        cv2.putText(frame, f"v1 {label}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 220, 0), 2)
        cv2.imshow("trackifyr cognitive load", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break


def run_v2(cap, model, args) -> None:
    mesh = FaceMeshExtractor(static_image=False)
    roller = V2Rolling()
    smooth_q: deque = deque(maxlen=args.smooth)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            row = mesh.process_frame(frame)
            vec = roller.update(row)
            if vec is None:
                label = "..."
                pred = 1
            else:
                pred = int(model.predict(vec.reshape(1, -1))[0])
                pred = smooth_label(smooth_q, pred)
                label = LABEL_NAMES[pred]
            cv2.putText(frame, f"v2 {label}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 200, 255), 2)
            cv2.imshow("trackifyr cognitive load", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        mesh.close()


def run_v3(cap, net, device, args) -> None:
    buf = V3FrameBuffer()
    smooth_q: deque = deque(maxlen=args.smooth)
    ema = np.ones(3, dtype=np.float64) / 3.0
    ema_beta = 0.75

    net.eval()
    with torch.no_grad():
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            t = frame_to_tensor_v3(frame)
            seq = buf.push(t)
            if seq is None:
                label = "buffering..."
                pred = 1
            else:
                x = seq.unsqueeze(0).to(device)
                logits = net(x)
                prob = torch.softmax(logits, dim=1).cpu().numpy()[0]
                ema = ema_beta * ema + (1 - ema_beta) * prob
                pred = int(np.argmax(ema))
                pred = smooth_label(smooth_q, pred)
                label = LABEL_NAMES[pred]
            cv2.putText(frame, f"v3 {label}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 180, 0), 2)
            cv2.imshow("trackifyr cognitive load", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", choices=("v1", "v2", "v3"), default="v2")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--smooth", type=int, default=7, help="majority window for stability")
    ap.add_argument(
        "--device",
        default="auto",
        help="v3 only: auto | cuda | cpu",
    )
    ap.add_argument("--v1-model", type=str, default=str(ARTIFACTS_DIR / "v1_rf.joblib"))
    ap.add_argument("--v2-model", type=str, default=str(ARTIFACTS_DIR / "v2_rf.joblib"))
    ap.add_argument("--v3-model", type=str, default=str(ARTIFACTS_DIR / "v3_cnn.pt"))
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.camera)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    if not cap.isOpened():
        raise SystemExit("Could not open webcam")

    ver = args.version
    if ver == "v1":
        bundle = joblib.load(args.v1_model)
        run_v1(cap, bundle["model"], args)
    elif ver == "v2":
        bundle = joblib.load(args.v2_model)
        run_v2(cap, bundle["model"], args)
    else:
        if args.device == "auto":
            device = get_device()
        elif args.device == "cuda":
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            device = torch.device("cpu")
        print(f"v3 using device: {device}")
        ckpt = torch.load(args.v3_model, map_location=device)
        cfg = ckpt["config"]
        net = CognitiveLoadNet3(n_classes=cfg["n_classes"], hidden=cfg.get("hidden", 128), pretrained=False)
        net.load_state_dict(ckpt["state_dict"])
        net.to(device)
        run_v3(cap, net, device, args)

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
