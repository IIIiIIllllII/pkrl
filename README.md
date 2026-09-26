# Pokémon Gen 3 RL → GBA Battle AI LUT

The audited schema is `gen3-lut-v1.1`, with Python as the reference and 349
policy parameters. The old v1 100M run is a contaminated historical baseline;
it and provisional v1.1 checkpoints are rejected as clean starting points.

Use the [reproducible runbook](docs/reboot_runbook.md) and
[reboot validation report](docs/reboot_validation.md). Long training requires
a successful preflight for the exact clean commit, configuration and runtime.
The local laptop benchmark is intentionally not the borrowed training-host
benchmark; correctness is complete and only that host-capacity measurement is
pending.

With Node 22.23.2, uv 0.12.9, Git, make and host C/C++ compilers installed:

```bash
bash scripts/bootstrap.sh
bash scripts/preflight.sh --config configs/train_v1_1_100m.yaml
```

Bootstrap provisions Python 3.12.13 and locked dependencies, checks out pinned
Showdown/pokeemerald revisions, applies tracked ROM integration, generates
required host headers, extracts trainers and builds the bridge and web app.

For a quick local functional check after bootstrap:

```bash
.venv/bin/python -m gen3rl.cli doctor
.venv/bin/python -m gen3rl.cli smoke --config configs/smoke.yaml
.venv/bin/python -m gen3rl.cli verify-parity
```

A bounded benchmark of the actual synchronous PPO training path:

```bash
bash scripts/benchmark_real_train.sh --config configs/train_v1_1_100m.yaml --decisions 32768
```

No long training is launched by bootstrap, tests, preflight or the benchmark.
The runbook contains the guarded command that would start clean 100M training
and the separate whole-run checkpoint recovery procedure.

The normal evaluation/export commands remain available for a schema-compatible
checkpoint:

```bash
.venv/bin/python -m gen3rl.cli evaluate --checkpoint CHECKPOINT.pt
.venv/bin/python -m gen3rl.cli export-lut --checkpoint CHECKPOINT.pt
```

The learner is synchronous and process-parallel: the proven clean-run settings
are 24 workers, 4096 decisions per rollout generation, four PPO epochs,
minibatches of 1024, CPU learning and one PyTorch thread. The old v1 100M
checkpoint, old web policies, and ignored historical run remain available only
as explicitly contaminated baselines; none can initialize v1.1 training.

- [Schema and represented mechanics](docs/schema_v1_1.md)
- [Initial repository audit](docs/reboot_audit.md)
- [ROM integration and host parity](integration/pokeemerald/README.md)
- [Historical human web playtest](web-playtest/README.md)
- [Old-run contamination analysis](docs/contamination_audit.md)

No ROM or baserom is included or downloaded. ROM/emulator validation requires
a separate legal ROM and GBA toolchain; host-C parity covers the encoder and
integer scorer. Historical web policies remain explicitly labeled v1.
