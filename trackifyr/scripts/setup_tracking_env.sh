#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "[trackifyr] Installing Python tracking dependencies..."
if command -v python3 >/dev/null 2>&1; then
  python3 -m pip install -r requirements.txt
else
  python -m pip install -r requirements.txt
fi
echo "[trackifyr] Done. Optional: export TRACKIFYR_PYTHON=/path/to/venv/bin/python"
