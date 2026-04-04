"""
Live cognitive load demo (v1 / v2 / v3) using the same feature pipelines as training.

  .venv\\Scripts\\python webcam_cognitive_load.py --version v2
  .venv\\Scripts\\python webcam_cognitive_load.py --version v3 --device cuda

Requires trained artifacts from train_daisee.py (defaults under artifacts/daisee/).
Press Q to quit.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
import traceback
from collections import Counter, deque
from pathlib import Path


def _emit_missing_dep(module_name: str) -> None:
    """Stdout JSON only — Electron parses this before any traceback."""
    print(
        json.dumps(
            {
                "_trackifyr_error": True,
                "error": "missing_dependency",
                "module": module_name,
                "stage": "import",
                "message": f"Missing module: {module_name}",
            }
        ),
        flush=True,
    )
    sys.exit(1)


try:
    import cv2
except ImportError:
    _emit_missing_dep("cv2")
try:
    import joblib
except ImportError:
    _emit_missing_dep("joblib")
try:
    import numpy as np
except ImportError:
    _emit_missing_dep("numpy")
try:
    import torch
except ImportError:
    _emit_missing_dep("torch")
try:
    import mediapipe  # noqa: F401
except ImportError:
    _emit_missing_dep("mediapipe")
try:
    import pandas  # noqa: F401
except ImportError:
    _emit_missing_dep("pandas")
try:
    import sklearn  # noqa: F401
except ImportError:
    _emit_missing_dep("sklearn")
try:
    import torchvision  # noqa: F401
except ImportError:
    _emit_missing_dep("torchvision")

try:
    from ml.daisee_common import ARTIFACTS_DIR, LABEL_NAMES
    from ml.ensemble_vote import ensemble_final_load
    from ml.features_v1 import NUM_SAMPLE_FRAMES, frame_mean_std, v1_vector_from_series
    from ml.features_v2 import FaceMeshExtractor, V2Rolling
    from ml.model_v3 import CognitiveLoadNet3, V3FrameBuffer, frame_to_tensor_v3, get_device
except ImportError as e:
    _emit_missing_dep(getattr(e, "name", None) or "ml")


def _log_webcam(msg: str) -> None:
    """All human-readable diagnostics go to stderr so stdout stays JSON-only in --stream-json mode."""
    print(f"[trackifyr webcam] {msg}", file=sys.stderr, flush=True)


def emit_stream_json_error(stage: str, message: str, **extra: object) -> None:
    """Single JSON line on stdout for Electron to parse (does not replace fused payloads)."""
    payload: dict = {"_trackifyr_error": True, "stage": stage, "message": message}
    payload.update({k: v for k, v in extra.items() if v is not None})
    print(json.dumps(payload), flush=True)


def emit_stream_event(event: str) -> None:
    """Diagnostic lifecycle line — ignored by fusion; must stay valid JSON."""
    print(json.dumps({"_trackifyr_event": event}), flush=True)


def try_open_webcam(camera_index: int):
    """
    Open a capture device. Logs each attempt to stderr.
    Returns cv2.VideoCapture or None if every index/backend failed.
    """
    win = platform.system() == "Windows"
    indices = [camera_index]
    if camera_index == 0:
        indices = [0, 1, 2]

    for idx in indices:
        attempts = []
        if win:
            attempts.append((idx, cv2.CAP_DSHOW))
            # Media Foundation — often works when DirectShow does not (Windows 10+).
            if hasattr(cv2, "CAP_MSMF"):
                attempts.append((idx, cv2.CAP_MSMF))
        attempts.append((idx, None))

        for _cap_idx, api in attempts:
            api_name = "default" if api is None else str(api)
            if api is None:
                cap = cv2.VideoCapture(idx)
            else:
                cap = cv2.VideoCapture(idx, api)
            opened = cap.isOpened()
            _log_webcam(f"VideoCapture index={idx} api={api_name} isOpened={opened}")
            if not opened:
                try:
                    cap.release()
                except Exception:
                    pass
                continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            ok = False
            for attempt in range(10):
                ok, _ = cap.read()
                if ok:
                    break
                time.sleep(0.05)
            _log_webcam(f"index={idx} api={api_name} test_read_ok={ok}")
            if ok:
                _log_webcam(f"using camera index={idx} api={api_name}")
                return cap
            try:
                cap.release()
            except Exception:
                pass

    _log_webcam(
        "failed to open any camera (try TRACKIFYR_WEBCAM_INDEX, close other apps, "
        "or TRACKIFYR_WEBCAM_VERBOSE=1)"
    )
    return None


def open_webcam(camera_index: int):
    """Open webcam or exit with non-stream-json friendly message."""
    cap = try_open_webcam(camera_index)
    if cap is None:
        raise SystemExit(
            "Could not open webcam (try TRACKIFYR_WEBCAM_INDEX=1, close other apps using the camera, "
            "or set TRACKIFYR_WEBCAM_VERBOSE=1 for details)"
        )
    return cap


def smooth_label(history: deque, pred: int, window: int = 7) -> int:
    history.append(pred)
    if len(history) < 3:
        return pred
    return Counter(history).most_common(1)[0][0]


# EAR combined is row[2]; yaw proxy is row[4] (see ml.features_v2._per_frame_feats)
BLINK_EAR_CLOSED = 0.20
GAZE_YAW_ABS_AWAY = 0.35


def run_v1(cap, model, args) -> None:
    means: list[float] = []
    stds: list[float] = []
    smooth_q: deque = deque(maxlen=args.smooth)
    fps_smooth = 30.0
    alpha = 0.9
    frames = 0

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
        frames += 1
        if args.max_frames and frames >= args.max_frames:
            break
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break


def run_v2(cap, model, args) -> None:
    mesh = FaceMeshExtractor(static_image=False)
    roller = V2Rolling()
    smooth_q: deque = deque(maxlen=args.smooth)
    frames = 0
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
            frames += 1
            if args.max_frames and frames >= args.max_frames:
                break
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
    frames = 0
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
            frames += 1
            if args.max_frames and frames >= args.max_frames:
                break
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break


def run_combined_stream_json(cap, v1_model, v2_model, net_v3, device, args) -> None:
    """Run v1, v2, and v3 on each frame; emit one JSON line per interval on stdout."""
    mesh = FaceMeshExtractor(static_image=False)
    roller = V2Rolling()
    smooth_q1: deque = deque(maxlen=args.smooth)
    smooth_q2: deque = deque(maxlen=args.smooth)
    smooth_q3: deque = deque(maxlen=args.smooth)

    means: list[float] = []
    stds: list[float] = []
    fps_smooth = 30.0
    alpha = 0.9

    buf = V3FrameBuffer()
    ema = np.ones(3, dtype=np.float64) / 3.0
    ema_beta = 0.75

    net_v3.eval()
    _log_webcam("stream-json inference loop started")

    prev_ear: float | None = None
    interval_blinks = 0
    interval_gaze_away = 0
    last_face = False

    interval_sec = float(getattr(args, "json_interval", 10.0))
    next_emit = time.monotonic() + interval_sec
    show_ui = bool(getattr(args, "preview", False))

    frames = 0
    consecutive_bad_frames = 0
    max_bad = 120  # ~few seconds at typical FPS before giving up
    try:
        with torch.no_grad():
            while True:
                ok, frame = cap.read()
                if not ok or frame is None:
                    consecutive_bad_frames += 1
                    if consecutive_bad_frames >= max_bad:
                        _log_webcam(f"too many bad frames ({consecutive_bad_frames}), stopping loop")
                        break
                    time.sleep(0.02)
                    continue
                consecutive_bad_frames = 0

                m, s = frame_mean_std(frame)
                means.append(m)
                stds.append(s)
                means = means[-NUM_SAMPLE_FRAMES:]
                stds = stds[-NUM_SAMPLE_FRAMES:]
                vec = v1_vector_from_series(means, stds, fps=fps_smooth, n_frames_reported=float(len(means)))
                proba = v1_model.predict_proba(vec.reshape(1, -1))[0]
                pred1 = int(np.argmax(proba))
                pred1 = smooth_label(smooth_q1, pred1)
                lv1 = LABEL_NAMES[pred1]
                fps_smooth = alpha * fps_smooth + (1 - alpha) * (cap.get(cv2.CAP_PROP_FPS) or 30.0)

                row = mesh.process_frame(frame)
                if row is not None:
                    last_face = True
                    ear = float(row[2])
                    yaw = float(row[4])
                    if prev_ear is not None and prev_ear >= BLINK_EAR_CLOSED and ear < BLINK_EAR_CLOSED:
                        interval_blinks += 1
                    prev_ear = ear
                    if abs(yaw) > GAZE_YAW_ABS_AWAY:
                        interval_gaze_away += 1
                else:
                    last_face = False
                    prev_ear = None

                vec2 = roller.update(row)
                if vec2 is None:
                    proba2 = np.ones(3, dtype=np.float64) / 3.0
                    pred2 = 1
                else:
                    proba2 = np.asarray(
                        v2_model.predict_proba(vec2.reshape(1, -1))[0],
                        dtype=np.float64,
                    )
                    pred2 = int(np.argmax(proba2))
                    pred2 = smooth_label(smooth_q2, pred2)
                lv2 = LABEL_NAMES[pred2]

                t3 = frame_to_tensor_v3(frame)
                seq = buf.push(t3)
                if seq is None:
                    pred3 = 1
                else:
                    x = seq.unsqueeze(0).to(device)
                    logits = net_v3(x)
                    prob = torch.softmax(logits, dim=1).cpu().numpy()[0]
                    ema = ema_beta * ema + (1 - ema_beta) * prob
                    pred3 = int(np.argmax(ema))
                    pred3 = smooth_label(smooth_q3, pred3)
                lv3 = LABEL_NAMES[pred3]

                if show_ui:
                    cv2.putText(
                        frame,
                        f"{lv1} | {lv2} | {lv3}",
                        (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.9,
                        (0, 220, 0),
                        2,
                    )
                    cv2.imshow("trackifyr cognitive load", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                frames += 1
                if args.max_frames and frames >= args.max_frames:
                    break

                now = time.monotonic()
                if now >= next_emit:
                    final = ensemble_final_load(lv1, lv2, lv3)
                    p1 = np.asarray(proba, dtype=np.float64)
                    p3 = np.asarray(ema, dtype=np.float64)
                    p_avg = (p1 + proba2 + p3) / 3.0
                    s = float(np.sum(p_avg))
                    if s > 1e-9:
                        p_avg = p_avg / s
                    payload = {
                        "timestamp": time.time(),
                        "v1_prediction": lv1,
                        "v2_prediction": lv2,
                        "v3_prediction": lv3,
                        "blinks": int(interval_blinks),
                        "gaze_away": int(interval_gaze_away),
                        "face_detected": bool(last_face),
                        "final_model_load": final,
                        # Low/Medium/High class probabilities (mean softmax v1+v2+v3) for dashboard engagement %
                        "cognitive_proba": [
                            float(p_avg[0]),
                            float(p_avg[1]),
                            float(p_avg[2]),
                        ],
                    }
                    print(json.dumps(payload), flush=True)
                    interval_blinks = 0
                    interval_gaze_away = 0
                    next_emit = now + interval_sec
    finally:
        mesh.close()
        if show_ui:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Live cognitive load from webcam (v1 / v2 / v3). Press Q to quit.",
        epilog="Examples:  python webcam_cognitive_load.py --version v2\n"
        "          python webcam_cognitive_load.py --version v3 --device cuda\n"
        "          python webcam_cognitive_load.py --version v1 --max-frames 60",
    )
    ap.add_argument("--version", choices=("v1", "v2", "v3"), default="v2")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Stop after this many frames (0 = run until Q). Useful for quick tests.",
    )
    ap.add_argument("--smooth", type=int, default=7, help="majority window for stability")
    ap.add_argument(
        "--device",
        default="auto",
        help="v3 only: auto | cuda | cpu",
    )
    ap.add_argument("--v1-model", type=str, default=str(ARTIFACTS_DIR / "v1_rf.joblib"))
    ap.add_argument("--v2-model", type=str, default=str(ARTIFACTS_DIR / "v2_rf.joblib"))
    ap.add_argument("--v3-model", type=str, default=str(ARTIFACTS_DIR / "v3_cnn.pt"))
    ap.add_argument(
        "--stream-json",
        action="store_true",
        help="Run v1+v2+v3 together; print one JSON object per line on stdout (use for Electron).",
    )
    ap.add_argument(
        "--json-interval",
        type=float,
        default=10.0,
        metavar="SEC",
        help="Seconds between JSON lines when using --stream-json (default: 10).",
    )
    ap.add_argument(
        "--preview",
        action="store_true",
        help="With --stream-json, show OpenCV window (press Q to quit).",
    )
    args = ap.parse_args()
    if getattr(args, "stream_json", False) and args.json_interval <= 0:
        raise SystemExit("--json-interval must be greater than 0")

    if args.stream_json:
        emit_stream_event("script_started")
        p1, p2, p3 = Path(args.v1_model), Path(args.v2_model), Path(args.v3_model)
        for label, p in (("v1", p1), ("v2", p2), ("v3", p3)):
            if not p.is_file():
                emit_stream_json_error("model", f"Model file not found for {label}", path=str(p.resolve()))
                _log_webcam(f"abort: missing model {label} at {p}")
                raise SystemExit(1)
        _log_webcam(f"stream-json v1+v2+v3 json_interval={args.json_interval}s")
        if args.max_frames:
            _log_webcam(f"will exit after {args.max_frames} frames")

        try:
            bundle1 = joblib.load(args.v1_model)
            bundle2 = joblib.load(args.v2_model)
        except Exception as e:
            emit_stream_json_error("model_load", str(e), exc_type=type(e).__name__, path_v12="v1/v2 joblib")
            _log_webcam(f"joblib load failed: {e}")
            raise SystemExit(1) from None

        if args.device == "auto":
            device = get_device()
        elif args.device == "cuda":
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            device = torch.device("cpu")
        _log_webcam(f"v3 using device: {device}")

        try:
            ckpt = torch.load(args.v3_model, map_location=device)
            cfg = ckpt["config"]
            net = CognitiveLoadNet3(n_classes=cfg["n_classes"], hidden=cfg.get("hidden", 128), pretrained=False)
            net.load_state_dict(ckpt["state_dict"])
            net.to(device)
        except Exception as e:
            emit_stream_json_error("model_load", str(e), exc_type=type(e).__name__, path=str(Path(args.v3_model).resolve()))
            _log_webcam(f"v3 checkpoint load failed: {e}")
            if os.environ.get("TRACKIFYR_WEBCAM_VERBOSE", "").strip() == "1":
                traceback.print_exc(file=sys.stderr)
            raise SystemExit(1) from None

        emit_stream_event("models_loaded")
        _log_webcam("models loaded; opening camera")
        cap = try_open_webcam(args.camera)
        if cap is None:
            emit_stream_json_error(
                "camera",
                "Could not open webcam (see stderr for backend attempts)",
            )
            raise SystemExit(1)

        emit_stream_event("camera_initialized")

        try:
            run_combined_stream_json(cap, bundle1["model"], bundle2["model"], net, device, args)
        except KeyboardInterrupt:
            _log_webcam("Stopping webcam (stream-json).")
        except Exception as e:
            _log_webcam(f"fatal: {type(e).__name__}: {e}")
            emit_stream_json_error("runtime", str(e), exc_type=type(e).__name__)
            if os.environ.get("TRACKIFYR_WEBCAM_VERBOSE", "").strip() == "1":
                traceback.print_exc(file=sys.stderr)
            raise SystemExit(1) from None
        finally:
            try:
                cap.release()
            except Exception:
                pass
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass
        return

    cap = open_webcam(args.camera)

    ver = args.version
    model_paths = {"v1": Path(args.v1_model), "v2": Path(args.v2_model), "v3": Path(args.v3_model)}
    mp = model_paths[ver]
    if not mp.is_file():
        raise SystemExit(f"Model not found for {ver}: {mp}")
    print(f"trackifyr webcam: version={ver}  model={mp.resolve()}", flush=True)
    if args.max_frames:
        print(f"trackifyr webcam: will exit after {args.max_frames} frames", flush=True)

    try:
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
    finally:
        try:
            cap.release()
        except Exception:
            pass
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass


if __name__ == "__main__":
    main()
