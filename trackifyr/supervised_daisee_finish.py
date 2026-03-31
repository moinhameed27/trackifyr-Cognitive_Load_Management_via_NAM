"""
Run v3 until train_daisee completes successfully, then evaluate v1/v2/v3 on Test.

Designed for overnight / unreliable power: any non-zero exit from training waits and retries
(the next run resumes from artifacts/daisee/checkpoints/v3_train_full.pt).

Usage (from trackifyr/):
  .venv\\Scripts\\python.exe supervised_daisee_finish.py

Note: If the machine loses power, the process stops; after power returns, run this again once.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG = ROOT / "artifacts" / "daisee" / "supervised_pipeline.log"
V3_CKPT = ROOT / "artifacts" / "daisee" / "checkpoints" / "v3_train_full.pt"
V3_OUT = ROOT / "artifacts" / "daisee" / "v3_cnn.pt"


def slog(msg: str) -> None:
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line, flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run_v3_forever(args: argparse.Namespace) -> None:
    py = sys.executable
    train_cmd = [
        py,
        "-u",
        str(ROOT / "train_daisee.py"),
        "v3",
        "--epochs",
        str(args.epochs),
        "--batch-size",
        str(args.batch_size),
        "--checkpoint-every-batches",
        str(args.checkpoint_every_batches),
        "--checkpoint-min-secs",
        str(args.checkpoint_min_secs),
    ]
    attempt = 0
    while True:
        attempt += 1
        slog(f"v3 training attempt {attempt} (resume uses checkpoint if present)")
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        rc = subprocess.run(train_cmd, cwd=str(ROOT), env=env)
        if rc.returncode == 0:
            slog("v3 train_daisee exited 0 — assuming complete")
            if V3_CKPT.is_file():
                slog("warning: v3 checkpoint still exists after success; check train_daisee.py cleanup")
            if not V3_OUT.is_file():
                slog("error: v3_cnn.pt missing after success")
                time.sleep(args.retry_secs)
                continue
            return
        slog(f"v3 failed exit={rc.returncode}, retry in {args.retry_secs}s")
        time.sleep(args.retry_secs)


def run_eval_all() -> None:
    py = sys.executable
    for ver in ("v1", "v2", "v3"):
        slog(f"=== eval_daisee_test {ver} ===")
        rc = subprocess.run(
            [py, "-u", str(ROOT / "eval_daisee_test.py"), "--version", ver],
            cwd=str(ROOT),
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        if rc.returncode != 0:
            slog(f"eval {ver} failed exit={rc.returncode}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=16)
    ap.add_argument("--batch-size", type=int, default=12)
    ap.add_argument("--checkpoint-every-batches", type=int, default=2)
    ap.add_argument("--checkpoint-min-secs", type=float, default=20.0)
    ap.add_argument("--retry-secs", type=int, default=60, help="Wait before retrying v3 after failure")
    ap.add_argument("--skip-eval", action="store_true")
    args = ap.parse_args()

    slog("supervised_daisee_finish started")
    run_v3_forever(args)
    if not args.skip_eval:
        run_eval_all()
    slog("supervised_daisee_finish done")


if __name__ == "__main__":
    main()
