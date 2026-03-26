"""
Train DAiSEE baselines: v1 (OpenCV+RF), v2 (MediaPipe+RF), v3 (MobileNet+GRU, GPU if available).

Resume after crash / power loss
--------------------------------
By default, partial progress is saved under ``artifacts/daisee/checkpoints/``:
  v1/v2: compressed .npz of feature matrices + next dataframe row index (saved often).
  v3: PyTorch .pt with model, optimizer, epoch, and batch index.

Use ``--fresh`` to ignore/delete checkpoints and start from scratch.

  .venv\\Scripts\\python train_daisee.py v1
  .venv\\Scripts\\python train_daisee.py v1 --fresh
  .venv\\Scripts\\python train_daisee.py v3 --checkpoint-every-batches 5
"""

from __future__ import annotations

import argparse
import json
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader, Dataset

warnings.filterwarnings("ignore", category=UserWarning)

from ml.daisee_common import ARTIFACTS_DIR, LABEL_NAMES, load_split
from ml.features_v1 import extract_features_v1
from ml.features_v2 import FaceMeshExtractor, extract_features_v2
from ml.model_v3 import NUM_TEMPORAL_FRAMES, CognitiveLoadNet3, get_device, load_clip_tensor_v3
from ml.training_checkpoints import (
    CHECKPOINT_ROOT,
    clear_sklearn_checkpoint,
    load_sklearn_featurize_checkpoint,
    save_sklearn_featurize_checkpoint,
    should_save_checkpoint,
    v1_train_npz,
    v1_val_npz,
    v2_train_npz,
    v2_val_npz,
    v3_train_pt,
)

V3_EPOCH_SEED_MULT = 1_000_003


def _maybe_limit(df: pd.DataFrame, limit: int | None) -> pd.DataFrame:
    if limit is None or limit <= 0:
        return df
    return df.head(limit).reset_index(drop=True)


def _limit_meta_val(limit: int | None) -> int:
    return -1 if limit is None else int(limit)


def _meta_featurize(split: str, n_rows: int, limit: int | None, pipeline: str) -> dict:
    return {"split": split, "n_rows": n_rows, "limit": _limit_meta_val(limit), "pipeline": pipeline}


def _featurize_meta_matches(saved: dict, expected: dict) -> bool:
    for k, v in expected.items():
        if saved.get(k) != v:
            return False
    return True


def _empty_np_stack(X_list: list[np.ndarray], y_list: list[int]) -> tuple[np.ndarray, np.ndarray]:
    if not X_list:
        raise RuntimeError("No features extracted.")
    return np.stack(X_list, axis=0), np.array(y_list, dtype=np.int64)


def run_v1_featurize_phase(
    df: pd.DataFrame,
    split_name: str,
    ckpt_path: Path,
    args: argparse.Namespace,
) -> tuple[np.ndarray, np.ndarray]:
    import time

    try:
        from tqdm import tqdm
    except ImportError:
        tqdm = None  # type: ignore

    rows = list(df.itertuples(index=False))
    n = len(rows)
    meta_exp = _meta_featurize(split_name, n, args.limit, "v1")

    X_list: list[np.ndarray] = []
    y_list: list[int] = []
    start_i = 0

    if not args.fresh:
        loaded = load_sklearn_featurize_checkpoint(ckpt_path)
        if loaded is not None:
            X_part, y_part, next_i, meta = loaded
            if _featurize_meta_matches(meta, meta_exp):
                start_i = next_i
                if X_part.size and len(y_part):
                    X_list = [X_part[i].astype(np.float32, copy=False) for i in range(X_part.shape[0])]
                    y_list = [int(y_part[i]) for i in range(len(y_part))]
                print(f"  Resuming v1 {split_name} from row {start_i}/{n} ({len(X_list)} feature vectors)")
            else:
                print(f"  Checkpoint meta mismatch; ignoring {ckpt_path.name}")
                clear_sklearn_checkpoint(ckpt_path)
    else:
        clear_sklearn_checkpoint(ckpt_path)

    last_save = time.monotonic()
    clips_since_ckpt = 0
    skip = 0

    rng_iter = range(start_i, n)
    if tqdm is not None:
        rng_iter = tqdm(rng_iter, desc=f"v1 {split_name}", initial=start_i, total=n)

    for i in rng_iter:
        row = rows[i]
        feat = extract_features_v1(Path(row.video_path))
        if feat is None:
            skip += 1
        else:
            X_list.append(feat)
            y_list.append(int(row.cognitive_load))

        clips_since_ckpt += 1
        need_time = should_save_checkpoint(last_save, args.checkpoint_min_secs)
        if clips_since_ckpt >= args.checkpoint_every or need_time or i == n - 1:
            if X_list:
                X_arr, y_arr = _empty_np_stack(X_list, y_list)
            else:
                X_arr = np.empty((0, 28), dtype=np.float32)
                y_arr = np.empty((0,), dtype=np.int64)
            save_sklearn_featurize_checkpoint(ckpt_path, X_arr, y_arr, i + 1, meta_exp)
            last_save = time.monotonic()
            clips_since_ckpt = 0

    if skip:
        print(f"  [{split_name}] skipped {skip} clips (missing video)")
    X_out, y_out = _empty_np_stack(X_list, y_list)
    clear_sklearn_checkpoint(ckpt_path)
    return X_out, y_out


def run_v2_featurize_phase(
    df: pd.DataFrame,
    split_name: str,
    ckpt_path: Path,
    args: argparse.Namespace,
    extractor: FaceMeshExtractor,
) -> tuple[np.ndarray, np.ndarray]:
    import time

    try:
        from tqdm import tqdm
    except ImportError:
        tqdm = None  # type: ignore

    rows = list(df.itertuples(index=False))
    n = len(rows)
    meta_exp = _meta_featurize(split_name, n, args.limit, "v2")

    X_list: list[np.ndarray] = []
    y_list: list[int] = []
    start_i = 0

    if not args.fresh:
        loaded = load_sklearn_featurize_checkpoint(ckpt_path)
        if loaded is not None:
            X_part, y_part, next_i, meta = loaded
            if _featurize_meta_matches(meta, meta_exp):
                start_i = next_i
                if X_part.size and len(y_part):
                    X_list = [X_part[i].astype(np.float32, copy=False) for i in range(X_part.shape[0])]
                    y_list = [int(y_part[i]) for i in range(len(y_part))]
                print(f"  Resuming v2 {split_name} from row {start_i}/{n} ({len(X_list)} feature vectors)")
            else:
                print(f"  Checkpoint meta mismatch; ignoring {ckpt_path.name}")
                clear_sklearn_checkpoint(ckpt_path)
    else:
        clear_sklearn_checkpoint(ckpt_path)

    last_save = time.monotonic()
    clips_since_ckpt = 0
    skip = 0

    rng_iter = range(start_i, n)
    if tqdm is not None:
        rng_iter = tqdm(rng_iter, desc=f"v2 {split_name}", initial=start_i, total=n)

    for i in rng_iter:
        row = rows[i]
        feat = extract_features_v2(Path(row.video_path), extractor=extractor)
        if feat is None:
            skip += 1
        else:
            X_list.append(feat)
            y_list.append(int(row.cognitive_load))

        clips_since_ckpt += 1
        need_time = should_save_checkpoint(last_save, args.checkpoint_min_secs)
        if clips_since_ckpt >= args.checkpoint_every or need_time or i == n - 1:
            if X_list:
                X_arr, y_arr = _empty_np_stack(X_list, y_list)
            else:
                X_arr = np.empty((0, 13), dtype=np.float32)
                y_arr = np.empty((0,), dtype=np.int64)
            save_sklearn_featurize_checkpoint(ckpt_path, X_arr, y_arr, i + 1, meta_exp)
            last_save = time.monotonic()
            clips_since_ckpt = 0

    if skip:
        print(f"  [{split_name}] skipped {skip} clips (no face / short)")
    X_out, y_out = _empty_np_stack(X_list, y_list)
    clear_sklearn_checkpoint(ckpt_path)
    return X_out, y_out


def run_v1(args: argparse.Namespace) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    train_df = _maybe_limit(load_split("Train"), args.limit)
    val_df = _maybe_limit(load_split("Validation"), args.limit)

    print("v1: extracting train features (checkpoints every ~{} clips or {}s)...".format(
        args.checkpoint_every, args.checkpoint_min_secs
    ))
    X_train, y_train = run_v1_featurize_phase(
        train_df, "Train", v1_train_npz(ckpt_dir, args.limit), args
    )
    print("v1: extracting val features...")
    # val: use separate fresh cycle — if user only wants resume train, pass fresh only for val conflict
    # For simplicity, val uses same --fresh only at very start; after train completes, val ckpt is separate
    vargs = argparse.Namespace(**vars(args))
    vargs.fresh = args.fresh  # if user resumed train, don't fresh val unless they deleted val ckpt
    X_val, y_val = run_v1_featurize_phase(val_df, "Validation", v1_val_npz(ckpt_dir, args.limit), vargs)

    clf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        random_state=args.seed,
        class_weight="balanced",
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)
    pred = clf.predict(X_val)
    print("\n=== v1 Validation ===")
    print(confusion_matrix(y_val, pred))
    print(classification_report(y_val, pred, target_names=list(LABEL_NAMES), zero_division=0))

    bundle = {
        "version": "v1",
        "kind": "sklearn_rf",
        "model": clf,
        "feature_dim": int(X_train.shape[1]),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, out)
    print(f"Saved {out}")


def run_v2(args: argparse.Namespace) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    train_df = _maybe_limit(load_split("Train"), args.limit)
    val_df = _maybe_limit(load_split("Validation"), args.limit)

    ext = FaceMeshExtractor(static_image=True)
    try:
        print("v2: extracting train features (MediaPipe)...")
        X_train, y_train = run_v2_featurize_phase(
            train_df, "Train", v2_train_npz(ckpt_dir, args.limit), args, ext
        )
        print("v2: extracting val features...")
        vargs = argparse.Namespace(**vars(args))
        X_val, y_val = run_v2_featurize_phase(
            val_df, "Validation", v2_val_npz(ckpt_dir, args.limit), vargs, ext
        )
    finally:
        ext.close()

    clf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        random_state=args.seed,
        class_weight="balanced",
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)
    pred = clf.predict(X_val)
    print("\n=== v2 Validation ===")
    print(confusion_matrix(y_val, pred))
    print(classification_report(y_val, pred, target_names=list(LABEL_NAMES), zero_division=0))

    bundle = {
        "version": "v2",
        "kind": "sklearn_rf",
        "model": clf,
        "feature_dim": int(X_train.shape[1]),
    }
    out = Path(args.out)
    joblib.dump(bundle, out)
    print(f"Saved {out}")


class V3ClipDataset(Dataset):
    def __init__(self, df: pd.DataFrame) -> None:
        self.rows = list(df.itertuples(index=False))

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int):
        row = self.rows[idx]
        t = load_clip_tensor_v3(Path(row.video_path))
        if t is None:
            return None
        y = int(row.cognitive_load)
        return t, y


def v3_collate(batch):
    batch = [b for b in batch if b is not None]
    if not batch:
        return None, None
    xs, ys = zip(*batch)
    x = torch.stack(xs, dim=0)
    y = torch.tensor(ys, dtype=torch.long)
    return x, y


def _v3_train_loader(train_ds, batch_size: int, epoch: int, seed: int):
    g = torch.Generator()
    g.manual_seed(seed + epoch * V3_EPOCH_SEED_MULT)
    return DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        collate_fn=v3_collate,
        drop_last=False,
        generator=g,
    )


def run_v3(args: argparse.Namespace) -> None:
    import torch.nn as nn

    device = get_device()
    print(f"v3: device = {device}")

    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    train_ckpt = v3_train_pt(ckpt_dir, args.limit)

    train_df = _maybe_limit(load_split("Train"), args.limit)
    val_df = _maybe_limit(load_split("Validation"), args.limit)

    train_ds = V3ClipDataset(train_df)
    val_ds = V3ClipDataset(val_df)

    val_ld = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        collate_fn=v3_collate,
    )

    y_all = train_df["cognitive_load"].to_numpy()
    counts = np.bincount(y_all, minlength=3).astype(np.float64)
    counts[counts == 0] = 1.0
    w = (len(y_all) / (3.0 * counts)).astype(np.float32)
    crit = nn.CrossEntropyLoss(weight=torch.tensor(w, device=device))

    start_epoch = 0
    start_batch = 0
    net = CognitiveLoadNet3(n_classes=3, hidden=args.hidden, pretrained=True).to(device)
    opt = torch.optim.AdamW(net.parameters(), lr=args.lr, weight_decay=1e-4)

    meta_exp = _meta_featurize("Train", len(train_df), args.limit, "v3_train")

    if not args.fresh and train_ckpt.is_file():
        ck = torch.load(train_ckpt, map_location=device, weights_only=False)
        smeta = ck.get("meta", {})
        if _featurize_meta_matches(smeta, meta_exp):
            net.load_state_dict(ck["model_state"])
            opt.load_state_dict(ck["optimizer_state"])
            start_epoch = int(ck["epoch"])
            start_batch = int(ck["batch_idx"])
            # batch_idx is "next index"; if >= batches in an epoch, that epoch already finished.
            batches_per_epoch = int(np.ceil(len(train_df) / max(1, args.batch_size)))
            if start_batch >= batches_per_epoch and batches_per_epoch > 0:
                start_epoch += 1
                start_batch = 0
                print(f"  Checkpoint was end-of-epoch — continuing from epoch {start_epoch}, batch 0")
            else:
                print(f"  Resuming v3 from epoch {start_epoch}, batch {start_batch} (next batch index)")
        else:
            print("  v3 checkpoint meta mismatch; starting fresh")
    elif args.fresh and train_ckpt.is_file():
        train_ckpt.unlink()

    p = np.array([])
    lab = np.array([])
    last_ckpt_time = time.monotonic()
    resume_epoch = start_epoch
    resume_batch_skip = start_batch

    for epoch in range(start_epoch, args.epochs):
        train_ld = _v3_train_loader(train_ds, args.batch_size, epoch, args.seed)
        net.train()
        tot, n = 0.0, 0
        batch_idx = 0
        skip_until = resume_batch_skip if epoch == resume_epoch else 0

        # Show progress to avoid "waiting for output" during the first epoch.
        try:
            from tqdm import tqdm

            total_batches = int(np.ceil(len(train_ds) / max(1, args.batch_size)))
            train_iter = tqdm(
                train_ld,
                desc=f"v3 train epoch {epoch+1}/{args.epochs}",
                total=total_batches,
            )
        except Exception:
            train_iter = train_ld

        for batch in train_iter:
            if batch_idx < skip_until:
                batch_idx += 1
                continue
            x, y = batch
            if x is None:
                batch_idx += 1
                continue
            x, y = x.to(device), y.to(device)
            opt.zero_grad(set_to_none=True)
            logits = net(x)
            loss = crit(logits, y)
            loss.backward()
            opt.step()
            tot += float(loss.item()) * x.size(0)
            n += x.size(0)

            batch_idx += 1
            if (
                batch_idx % args.checkpoint_every_batches == 0
                or should_save_checkpoint(last_ckpt_time, args.checkpoint_min_secs)
            ):
                torch.save(
                    {
                        "model_state": net.state_dict(),
                        "optimizer_state": opt.state_dict(),
                        "epoch": epoch,
                        "batch_idx": batch_idx,
                        "meta": meta_exp,
                        "hidden": args.hidden,
                        "lr": args.lr,
                    },
                    train_ckpt,
                )
                last_ckpt_time = time.monotonic()
                print(f"  [ckpt] epoch {epoch+1} batch {batch_idx} saved")

        if n:
            print(f"epoch {epoch+1}/{args.epochs} train loss {tot/n:.4f}")

        net.eval()
        preds, labels = [], []
        with torch.no_grad():
            for batch in val_ld:
                x, y = batch
                if x is None:
                    continue
                x = x.to(device)
                logits = net(x)
                preds.append(logits.argmax(dim=1).cpu().numpy())
                labels.append(y.numpy())
        if preds:
            p = np.concatenate(preds)
            lab = np.concatenate(labels)
            acc = float((p == lab).mean())
            print(f"  val acc {acc:.4f}")

        resume_batch_skip = 0

        torch.save(
            {
                "model_state": net.state_dict(),
                "optimizer_state": opt.state_dict(),
                "epoch": epoch + 1,
                "batch_idx": 0,
                "meta": meta_exp,
                "hidden": args.hidden,
                "lr": args.lr,
            },
            train_ckpt,
        )
        last_ckpt_time = time.monotonic()

    print("\n=== v3 Validation ===")
    if lab.size == 0:
        print("(no validation batches — try lowering --batch-size or increasing --limit)")
    else:
        print(confusion_matrix(lab, p))
        print(classification_report(lab, p, target_names=list(LABEL_NAMES), zero_division=0))

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    ckpt = {
        "state_dict": net.state_dict(),
        "config": {
            "version": "v3",
            "temporal_frames": NUM_TEMPORAL_FRAMES,
            "input_size": 112,
            "hidden": args.hidden,
            "n_classes": 3,
            "label_names": list(LABEL_NAMES),
        },
    }
    out_pt = Path(args.out)
    out_pt.parent.mkdir(parents=True, exist_ok=True)
    torch.save(ckpt, out_pt)
    if train_ckpt.is_file():
        train_ckpt.unlink()

    meta = {"device_trained": str(device)}
    with open(out_pt.with_suffix(out_pt.suffix + ".json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved {out_pt}")


def _add_checkpoint_args(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--checkpoint-dir",
        type=str,
        default=str(CHECKPOINT_ROOT),
        help="Directory for partial/resume files",
    )
    p.add_argument(
        "--fresh",
        action="store_true",
        help="Delete checkpoints for this run and start over",
    )
    p.add_argument(
        "--checkpoint-every",
        type=int,
        default=10,
        help="v1/v2: save partial features after this many dataframe rows processed",
    )
    p.add_argument(
        "--checkpoint-min-secs",
        type=float,
        default=20.0,
        help="v1/v2/v3: also save at least this many seconds apart (frequent safety net)",
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="DAiSEE training (v1 / v2 / v3)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("v1", help="OpenCV features + RandomForest")
    p1.add_argument("--limit", type=int, default=0, help="Max clips per split (0 = all)")
    p1.add_argument("--n-estimators", type=int, default=200)
    p1.add_argument("--max-depth", type=int, default=20)
    p1.add_argument("--seed", type=int, default=42)
    p1.add_argument("--out", type=str, default=str(ARTIFACTS_DIR / "v1_rf.joblib"))
    _add_checkpoint_args(p1)
    p1.set_defaults(func=run_v1)

    p2 = sub.add_parser("v2", help="MediaPipe features + RandomForest")
    p2.add_argument("--limit", type=int, default=0)
    p2.add_argument("--n-estimators", type=int, default=250)
    p2.add_argument("--max-depth", type=int, default=24)
    p2.add_argument("--seed", type=int, default=42)
    p2.add_argument("--out", type=str, default=str(ARTIFACTS_DIR / "v2_rf.joblib"))
    _add_checkpoint_args(p2)
    p2.set_defaults(func=run_v2)

    p3 = sub.add_parser("v3", help="MobileNetV3 + GRU (CUDA if available)")
    p3.add_argument("--limit", type=int, default=0)
    p3.add_argument("--epochs", type=int, default=8)
    p3.add_argument("--seed", type=int, default=42)
    p3.add_argument("--batch-size", type=int, default=8)
    p3.add_argument("--lr", type=float, default=3e-4)
    p3.add_argument("--hidden", type=int, default=128)
    p3.add_argument("--out", type=str, default=str(ARTIFACTS_DIR / "v3_cnn.pt"))
    _add_checkpoint_args(p3)
    p3.add_argument(
        "--checkpoint-every-batches",
        type=int,
        default=3,
        help="v3: save training checkpoint every N train batches",
    )
    p3.set_defaults(func=run_v3)

    args = ap.parse_args()
    if getattr(args, "limit", 0) == 0:
        args.limit = None
    args.func(args)


if __name__ == "__main__":
    main()
