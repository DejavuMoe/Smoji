#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}
REPORT=${1:-}

if [ -n "$REPORT" ]; then
  PYTHONDONTWRITEBYTECODE=1 "$PYTHON_BIN" "$SCRIPT_DIR/run_all.py" \
    --python "$PYTHON_BIN" --report "$REPORT"
else
  PYTHONDONTWRITEBYTECODE=1 "$PYTHON_BIN" "$SCRIPT_DIR/run_all.py" \
    --python "$PYTHON_BIN"
fi
