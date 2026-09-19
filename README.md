# Pokémon Gen 3 RL → GBA Battle AI LUT

This project controls the official Pokémon Showdown Gen 3 simulator through one
persistent JSONL worker, trains a directly exportable additive lookup-table
policy with masked PPO, quantizes it, generates C, verifies exact host-C parity,
and hooks move scoring into the official pokeemerald decomp.

No ROM or baserom is included or downloaded.

## Quick start

Python 3.11+ and Node 22.18+ are required. The bootstrap performed for this
checkout uses a project-local npm CLI because the host image supplied Node
without npm.

```bash
uv sync --extra train --extra test
uv run python -m gen3rl.cli bootstrap
uv run python -m gen3rl.cli doctor
uv run python -m gen3rl.cli smoke
```

Training, evaluation, export, and parity:

```bash
uv run python -m gen3rl.cli train --config configs/train.yaml
uv run python -m gen3rl.cli evaluate --checkpoint artifacts/checkpoints/smoke.pt
uv run python -m gen3rl.cli export-lut --checkpoint artifacts/checkpoints/smoke.pt
uv run python -m gen3rl.cli verify-parity
```

Extract the checked-out cartridge trainers with:

```bash
uv run python -m gen3rl.cli extract-trainers
```

Official upstreams live under `third_party/pokemon-showdown` and
`third_party/pokeemerald`; exact revisions are in `docs/decisions.md`. Generated
LUTs are in `artifacts/generated`, checkpoints in `artifacts/checkpoints`, and
trainer JSONL in `artifacts/teams`.

The GBA build additionally requires pokeemerald's documented agbcc or modern
devkitARM toolchain and a legally obtained local `baserom.gba`. Their absence
does not affect simulation, training, export, or host parity.

## Long-run preparation

```bash
.venv/bin/python -m gen3rl.cli benchmark --minutes 10
.venv/bin/python -m gen3rl.cli preflight --config configs/train_2080ti_24h.yaml
.venv/bin/python -m gen3rl.cli train --config configs/train_2080ti_24h.yaml
```

Each training invocation creates `artifacts/runs/YYYYMMDD-HHMMSS` with its
resolved config, source metadata, JSONL metrics, evaluations, and checkpoints.
Resume without resetting counters, schedules, optimizer state, or RNG state:

```bash
.venv/bin/python -m gen3rl.cli train --config configs/train_2080ti_24h.yaml --resume artifacts/runs/RUN_ID/checkpoints/final.pt
```

## Vast.ai / 16-vCPU workflow

The rollout learner supports process-parallel simulation. Each Python rollout
worker owns one persistent Node BattleStream process; PPO remains synchronous
and runs only in the main process. Do not assume every visible CPU should be a
worker—measure the rented host and use the reported recommendation.

```bash
.venv/bin/python -m gen3rl.cli doctor
.venv/bin/python -m gen3rl.cli preflight --config configs/train_vast_16vcpu_100m.yaml
.venv/bin/python -m gen3rl.cli benchmark-scaling --workers 1,2,4,8,12,16 --minutes-per-setting 3
```

Inspect `artifacts/reports/scaling_summary.json`, then start the 100-million
decision run with its `recommended_workers` value:

```bash
.venv/bin/python -m gen3rl.cli train --config configs/train_vast_16vcpu_100m.yaml --workers RECOMMENDED_WORKERS
```

Resume from the newest recovery or milestone checkpoint without changing the
selected worker count:

```bash
.venv/bin/python -m gen3rl.cli train --config configs/train_vast_16vcpu_100m.yaml --workers RECOMMENDED_WORKERS --resume artifacts/runs/RUN_ID/checkpoints/safety_1000000.pt
```

The run keeps permanent milestone checkpoints through 100M decisions and only
the three newest rolling safety checkpoints. Quick fixed-seed evaluations run
at non-milestone 1M intervals; larger fixed-seed evaluations run at major
milestones. No provider credentials or ROM assets are required by this flow.
