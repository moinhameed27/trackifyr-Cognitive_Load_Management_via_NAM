"""Checkpoint paths and helpers for resumable DAiSEE training."""

from __future__ import annotations

import gc
import json
import os
import time
import uuid
from pathlib import Path

import numpy as np
import torch

from ml.daisee_common import ARTIFACTS_DIR

CHECKPOINT_ROOT = ARTIFACTS_DIR / "checkpoints"


def ckpt_limit_suffix(limit: int | None) -> str:
    return "full" if limit is None or limit <= 0 else str(int(limit))


def v1_train_npz(ckpt_dir: Path, limit: int | None) -> Path:
    return ckpt_dir / f"v1_Train_{ckpt_limit_suffix(limit)}.npz"


def v1_val_npz(ckpt_dir: Path, limit: int | None) -> Path:
    return ckpt_dir / f"v1_Validation_{ckpt_limit_suffix(limit)}.npz"


def v2_train_npz(ckpt_dir: Path, limit: int | None) -> Path:
    return ckpt_dir / f"v2_Train_{ckpt_limit_suffix(limit)}.npz"


def v2_val_npz(ckpt_dir: Path, limit: int | None) -> Path:
    return ckpt_dir / f"v2_Validation_{ckpt_limit_suffix(limit)}.npz"


def v3_train_pt(ckpt_dir: Path, limit: int | None) -> Path:
    return ckpt_dir / f"v3_train_{ckpt_limit_suffix(limit)}.pt"


def atomic_torch_save(obj: object, path: Path) -> None:
    """
    Write PyTorch payload atomically: save to a unique sibling .tmp file, then replace the
    destination. If power fails during torch.save, the previous checkpoint file stays intact.

    On Windows, ``replace`` can raise ``PermissionError`` if another handle (AV, Explorer,
    stale mmap) touches the file; we retry with backoff and a fresh temp name per call.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.stem}.{uuid.uuid4().hex}.pt.tmp")
    torch.save(obj, tmp)
    gc.collect()
    last: PermissionError | None = None
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError as e:
            last = e
            time.sleep(0.05 * (attempt + 1))
    try:
        tmp.unlink(missing_ok=True)
    except PermissionError:
        pass
    raise last if last else RuntimeError("atomic_torch_save: replace failed")


def save_sklearn_featurize_checkpoint(
    path: Path,
    X: np.ndarray,
    y: np.ndarray,
    next_row: int,
    meta: dict,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, X=X, y=y, next_row=np.array([next_row], dtype=np.int64))
    meta_path = path.parent / f"{path.stem}.meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


def load_sklearn_featurize_checkpoint(path: Path) -> tuple[np.ndarray, np.ndarray, int, dict] | None:
    if not path.is_file():
        return None
    z = np.load(path, allow_pickle=True)
    next_row = int(z["next_row"][0])
    X = np.asarray(z["X"])
    y = np.asarray(z["y"])
    meta_path = path.parent / f"{path.stem}.meta.json"
    meta: dict = {}
    if meta_path.is_file():
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
    return X, y, next_row, meta


def clear_sklearn_checkpoint(path: Path) -> None:
    if path.is_file():
        path.unlink()
    meta_path = path.parent / f"{path.stem}.meta.json"
    if meta_path.is_file():
        meta_path.unlink()


def should_save_checkpoint(last_save_time: float, min_interval_secs: float) -> bool:
    return (time.monotonic() - last_save_time) >= min_interval_secs
