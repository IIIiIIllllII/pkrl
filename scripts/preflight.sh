#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
trap 'echo "NOT READY FOR LONG RUN" >&2' ERR
.venv/bin/python -m gen3rl.preflight "$@"
