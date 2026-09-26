# Reproducible v1.1 training

The source of truth is this Git repository. Commit source changes before
preflight; copy the entire run directory for recovery. Never copy a patch only
to a cloud machine. The ignored historical v1 run and frozen v1 web policies
are contaminated research baselines, never clean initial weights.

Runtime: Linux, Git, make, host C/C++ compilers, Python **3.12.13**, Node **22.23.2**,
uv **0.12.9**, npm **11.6.0**. Bootstrap uses uv to provision Python and a pinned
local npm if needed. Install Node and uv at these versions before bootstrap.
Python dependencies are resolved by `uv.lock` with `uv sync --locked`:
torch **2.14.0** (tested build `2.14.0+cu130`, CPU learner), NumPy **2.5.3**,
PyYAML **6.0.3**, pytest **9.1.1**. Web dependencies use `npm ci` and the committed
`web-playtest/package-lock.json`. Bridge compilation uses the TypeScript
compiler in the exact Showdown checkout's locked dependencies. No global tsc
or undocumented patches are needed.

Showdown: `2ddfa0476f8207e12e204b1c69f7c7683b17633c`.
pokeemerald: `5eff78649e7170a877b961ef0b3da13b81a16038`.
Schema: `gen3-lut-v1.1`, semantics revision `2026-09-27-reboot`.

Fresh machine (after installing the prerequisites):

```bash
git clone git@github.com:IIIiIIllllII/pkrl.git
cd pkrl
bash scripts/bootstrap.sh
bash scripts/preflight.sh --config configs/train_v1_1_100m.yaml
```

Separate real-training benchmark, bounded to approximately 32K decisions
(complete episodes may overshoot the requested budget):

```bash
bash scripts/benchmark_real_train.sh --config configs/train_v1_1_100m.yaml --decisions 32768
```

It runs the production learner with 24 workers, 4096-decision generations,
four PPO epochs, minibatch 1024, CPU, and one PyTorch/BLAS thread. It reports
end-to-end and training rates, excludes the first generation only for the
separately named steady rate, and records every generation's phase timings.
The threshold is 4500 decisions/sec, below the historical 5400–5600 target.
A CPU-limited development machine can pass correctness and still fail this
performance gate. No extrapolation substitutes for a benchmark on the intended
training host. The older `benchmark`/`benchmark-scaling` commands are exploratory
rollout benchmarks and cannot authorize long training.

Preflight runs Python, TypeScript/web, portable C and actual ROM-adapter host
tests, privacy checks, coverage, integer scoring parity, and real PPO. Any
failure prints `NOT READY FOR LONG RUN` and exits nonzero. Its report is
`artifacts/reports/reboot/preflight.json`. Reports/runs are generated outputs;
commit durable findings to documentation. Long training rejects missing,
failed, stale-commit, changed-config or changed-runtime preflight results.

The command that **would** launch clean 100M training after a successful gate:

```bash
OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
  .venv/bin/python -m gen3rl.cli train --config configs/train_v1_1_100m.yaml
```

Do not add `--resume` for a clean start. Policy and value weights initialize
from the configured seed. Existing terminal rewards and opponent mixture are
unchanged. Historical self-play begins only with snapshots of this clean run.
Resume supports a whole copied run directory, including opponent snapshots:

```bash
OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
  .venv/bin/python -m gen3rl.cli train --config configs/train_v1_1_100m.yaml \
  --resume artifacts/runs/gen3-lut-v1.1/RUN/checkpoints/final.pt
```

Snapshots restore policy, value, Adam state, global and sampling RNGs, counters,
policy version, rate state and opponent pool. A failed mid-update generation
is rolled back before the atomic emergency checkpoint. Deterministic ordered
rollout consumption makes generation membership independent of worker finish
order. Exact repeatability assumes the same CPU runtime and worker count;
changing those is not a bitwise reproducibility claim.

The policy has 349 scalars: four action biases, 108 categorical entries across
20 features, and 237 entries across five pair tables. The training-only value
network has 5,249 parameters. ROM switching remains vanilla; host-C parity
does not claim GBA build/emulator validation or equality after vanilla score
clamping. No ROM or GBA toolchain is needed for the training preflight.
