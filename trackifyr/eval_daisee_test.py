"""Evaluate saved v1/v2/v3 models on the official DAiSEE Test split."""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix

from ml.daisee_common import LABEL_NAMES, load_split
from ml.features_v1 import extract_features_v1
from ml.features_v2 import FaceMeshExtractor, extract_features_v2
from ml.model_v3 import CognitiveLoadNet3, get_device, load_clip_tensor_v3


def _rows_iter(df, desc: str):
    rows = list(df.itertuples(index=False))
    try:
        from tqdm import tqdm

        return tqdm(rows, desc=desc, unit="clip")
    except ImportError:
        return rows


def eval_v1(model_path: Path, limit: int | None) -> None:
    bundle = joblib.load(model_path)
    clf = bundle["model"]
    df = load_split("Test")
    if limit:
        df = df.head(limit)
    X, y = [], []
    for row in _rows_iter(df, "v1 Test"):
        f = extract_features_v1(Path(row.video_path))
        if f is not None:
            X.append(f)
            y.append(row.cognitive_load)
    if not X:
        raise RuntimeError("No v1 features extracted (check video paths / OpenCV).")
    X = np.stack(X)
    y = np.array(y)
    p = clf.predict(X)
    print(confusion_matrix(y, p))
    print(classification_report(y, p, target_names=list(LABEL_NAMES), zero_division=0))


def eval_v2(model_path: Path, limit: int | None) -> None:
    bundle = joblib.load(model_path)
    clf = bundle["model"]
    df = load_split("Test")
    if limit:
        df = df.head(limit)
    X, y = [], []
    ext = FaceMeshExtractor(static_image=True)
    try:
        for row in _rows_iter(df, "v2 Test"):
            f = extract_features_v2(Path(row.video_path), extractor=ext)
            if f is not None:
                X.append(f)
                y.append(row.cognitive_load)
    finally:
        ext.close()
    if not X:
        raise RuntimeError("No v2 features extracted (check video paths / MediaPipe).")
    X = np.stack(X)
    y = np.array(y)
    p = clf.predict(X)
    print(confusion_matrix(y, p))
    print(classification_report(y, p, target_names=list(LABEL_NAMES), zero_division=0))


def eval_v3(ckpt_path: Path, limit: int | None) -> None:
    device = get_device()
    ckpt = torch.load(ckpt_path, map_location=device)
    cfg = ckpt["config"]
    net = CognitiveLoadNet3(n_classes=cfg["n_classes"], hidden=cfg.get("hidden", 128), pretrained=False)
    net.load_state_dict(ckpt["state_dict"])
    net.to(device)
    net.eval()
    df = load_split("Test")
    if limit:
        df = df.head(limit)
    preds, labels = [], []
    with torch.no_grad():
        for row in _rows_iter(df, "v3 Test"):
            t = load_clip_tensor_v3(Path(row.video_path))
            if t is None:
                continue
            logits = net(t.unsqueeze(0).to(device))
            preds.append(int(logits.argmax(dim=1).item()))
            labels.append(int(row.cognitive_load))
    if not labels:
        raise RuntimeError("No v3 clips processed (check video paths / CUDA).")
    y = np.array(labels)
    p = np.array(preds)
    print(confusion_matrix(y, p))
    print(classification_report(y, p, target_names=list(LABEL_NAMES), zero_division=0))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", choices=("v1", "v2", "v3"), required=True)
    ap.add_argument("--limit", type=int, default=0, help="Cap test clips (0 = all available with features)")
    args = ap.parse_args()
    limit = args.limit if args.limit > 0 else None
    base = Path(__file__).resolve().parent / "artifacts" / "daisee"
    if args.version == "v1":
        eval_v1(base / "v1_rf.joblib", limit)
    elif args.version == "v2":
        eval_v2(base / "v2_rf.joblib", limit)
    else:
        eval_v3(base / "v3_cnn.pt", limit)


if __name__ == "__main__":
    main()
