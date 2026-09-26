# Reboot audit — 2026-09-26

Read-only inventory before implementation: clean `main` at `1a86b48`, matching
`origin/main`, no tags or other local branches. Python package: features,
policy, PPO, runner, multiprocessing pool, bridge, extraction, evaluation and
C export. TypeScript: training bridge and separate web simulator/encoder;
legacy-v1 web encoder intentionally retains historical semantics. C: generated
integer scorer and tracked pokeemerald integration patch. Eight Python test
modules plus parity fixtures; web has four test modules. Python `uv.lock` and
web npm lock exist, but runtime versions and bootstrap are insufficiently
enforced. Config `train_v1_1_100m.yaml` already exists. Ignored historical
`20260919-173958/` is 357 MB; v1 artifacts and frozen web assets remain historical.

Duplicates: classification/effectiveness in Python `features/move_semantics.py`,
bridge `move-semantics.ts`, web `moveSemantics.ts`, and ROM patch. Encoding and
masking in Python encoder, web encoder, bridge legalActions, web simulator and
ROM adapter. Scoring in torch/NumPy LUT policy, export integer scorer, generated
C and web inference; report and contamination scripts contain additional
scoring/legacy paths.

Baseline: all 60 Python tests pass. Real CPU training, 24 workers, 4096 rollout,
4 PPO epochs, minibatch 1024, one torch thread: 8450 decisions / 8.5656 training
seconds = 986.5 decisions/sec (includes cProfile overhead, excludes startup and
final export). Two PPO updates total 0.1334 sec. Dispatch repeatedly parses
trainer JSONL: 432 loads / 369736 JSON decodes, 6.255 sec cumulative under
cProfile. This host is not the historical rented machine; historical rates
cannot be certified here.

Confirmed gaps: incomplete move exceptions; maybeTrapped masks disagree;
no-legal-action NumPy argmax fallback; ROM uses hidden actual target speed and
different first-turn semantics; patch embeds old v1 weights/header; C tests
inspect strings rather than execute the encoder. Async completion determines
generation boundaries. Separate single-worker RNG is not checkpointed.
Preflight benchmarks predominantly rollouts with a detached PPO update, omits
web checks, and does not enforce a real-training throughput threshold.

Existing v1.1 documentation and prior READY claims are historical evidence,
not acceptance of this reboot. No old checkpoint is an eligible clean start.
