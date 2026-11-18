#!/bin/bash
#SBATCH --job-name=swampwiki-text-smoke
#SBATCH --account=randall_lab
#SBATCH --partition=test
#SBATCH --cpus-per-task=2
#SBATCH --mem=4G
#SBATCH --time=00:10:00
set -euo pipefail
umask 077
: "${SWAMPWIKI_RUN_DIR:?Set the sealed run directory}"
run_dir="$SWAMPWIKI_RUN_DIR"
node_bin=/n/home09/obarrera/.conda/envs/ising_bootstrap/bin/node
python_bin=/n/netscratch/randall_lab/Everyone/obarrera/physics-atlas-encoders/20261104-v1/env/bin/python
export PYTHONPATH=/n/netscratch/randall_lab/Everyone/obarrera/physics-atlas-graph-design/20261105-v1/ui-deps
export PLAYWRIGHT_BROWSERS_PATH=/n/netscratch/randall_lab/Everyone/obarrera/physics-atlas-graph-design/20261105-v1/browsers
export PYTHONUNBUFFERED=1 PYTHONNOUSERSITE=1 PYTHONDONTWRITEBYTECODE=1
export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 NODE_OPTIONS=--max-old-space-size=2560
local_run=$(mktemp -d "${SLURM_TMPDIR:-/tmp}/swampwiki-${SLURM_JOB_ID}-XXXXXX")
trap 'status=$?; printf "exitCode=%s\njobId=%s\n" "$status" "$SLURM_JOB_ID" > "$run_dir/job-exit.txt"; rm -rf "$local_run"; exit "$status"' EXIT
"$python_bin" "$run_dir/stage.py" "$run_dir" "$local_run/project"
cd "$local_run/project"
"$node_bin" scripts/build-site.mjs > "$run_dir/build.log" 2>&1
"$python_bin" "$run_dir/browser.py" --project "$local_run/project" --output "$run_dir/browser" --node "$node_bin" > "$run_dir/browser.log" 2>&1
