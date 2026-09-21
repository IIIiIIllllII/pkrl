# Pre-long-run audit

> Historical note: this audit described the original `gen3-lut-v1` launch.
> That 100M run is now confirmed contaminated by the type-effectiveness bugs in
> `docs/contamination_audit.md`. It is not approval to resume v1. Current
> readiness must come from the v1.1 validation results.

## Blockers found and fixed

- **Forced switch policy was invalid.** Switch logits were initialized to the
  same `-1e9` sentinel as masked actions. A forced-switch-only state therefore
  argmaxed move slot 0, and the rollout silently substituted the first legal
  action. Switch logits are now neutral zero, the substitution is removed, and
  a mismatch aborts training.
- **The persistent worker was not reused.** Python launched Node once per
  battle. Training, evaluation, data collection, and benchmarking now reuse one
  worker and create/close many `BattleStream` instances inside it.
- **Train/deployment observations diverged.** Target HP, effectiveness, status,
  weather, and speed relation were constants in Python while pokeemerald used
  live state. Player-filtered protocol tracking now supplies revealed active
  target facts. Exact target HP is bucketed inside Node before JSON IPC.
- **Forced-switch masks retained move actions.** The encoder now masks all
  moves whenever `forceSwitch` is set.

## Correctness risks fixed

- Damaging moves with secondary status were misclassified as status moves.
- Nullable Showdown PP/base-power fields could crash long collection runs;
  Struggle and callback-driven moves are handled.
- Rollouts ignored configured PPO epochs/minibatches. PPO now performs shuffled
  multi-epoch minibatch updates with the original rollout log-probabilities and
  masks.
- The value model saw only move slot 0. It now sees all four move feature rows;
  it remains training-only.
- Checkpoints omitted counters, RNG state, and opponent-pool metadata. These are
  now saved and resume-tested with schema compatibility checking.
- ROM move roles only distinguished damage/status. Named recovery, protection,
  weather, field, phazing, pivot, self-KO and fixed-damage moves plus setup,
  debuff, and status effects are now categorized consistently.
- Generated-score boundary behavior now has explicit min/max, all-zero, tie,
  wide-accumulator, and saturation tests.

## RL_REPLACE order verification

For normal trainer singles, `OpponentHandleChooseMove` calls
`BattleAI_SetupAIData(ALL_MOVES_MASK)` before `BattleAI_ChooseMoveOrAction`.
Setup initializes scores and calls `CheckMoveLimitations(...,
MOVE_LIMITATIONS_ALL)`, zeroing PP-empty, disabled, Encore-incompatible, absent,
and otherwise unusable slots. At the start of `ChooseMoveOrAction_Singles`,
replace mode calls `BattleAIRL_ApplyMoveScores`; it skips every empty or
zero-scored slot, scores remaining candidates, clamps scores to 1–127, and then
sets script flags to zero. The unchanged vanilla maximum scan follows and uses
`Random() % numOfBestMoves` for equal-best ties. Illegal slots remain zero and
cannot beat a supported legal score.

`OpponentHandleChooseAction` still invokes `AI_TrySwitchOrUseItem` separately.
Battle Palace has its own early path. `BattleAIRL_IsSupported` rejects doubles,
link, Safari, roaming, first battle, Battle Tower/frontier, e-Reader, secret
base, in-game partner, and recorded-link modes, so those retain vanilla logic.

## Performance risks

- The final measured 300-battle CPU benchmark reached 102.9 battles/s and 1,123
  decisions/s. Showdown simulation used 54.8% of categorized phase time and
  JSONL/bridge waiting 23.4%; PPO used 1.6%. A binary IPC rewrite is not
  justified by current measurements.
- Single-state PyTorch dispatch was initially as expensive as simulation.
  Rollouts now use an immutable NumPy snapshot of the same additive LUT;
  PyTorch remains authoritative for PPO updates. Inference fell to 11.2% of
  categorized benchmark time, with explicit NumPy/PyTorch parity tests.
- One worker/concurrent battle is the measured baseline. Additional workers
  should be benchmarked on the target host before increasing the config.
- CUDA is optional. Per-operation CUDA launch overhead is expected to dominate
  this tiny policy; the committed 2080 Ti configuration defaults to CPU until
  its on-host benchmark says otherwise. This host exposed a CUDA-enabled Torch
  build but no usable NVIDIA device or `nvidia-smi`, so no 2080 Ti result is
  claimed.

## Readiness validation

- 28 tests pass, including forced-switch masking, NumPy/Torch actor parity,
  PPO/checkpoint behavior, hidden-information isolation, quantization, and
  compiled host-C parity.
- A clean medium run completed 166 battles, 1,600 decisions, and seven PPO
  updates with zero illegal actions and 271 of 349 LUT scalars changed.
- Resume from the 1,500-decision checkpoint restored optimizer, RNG, counters,
  and schedule, then advanced without resetting them.
- Preflight returned `READY FOR LONG RUN` with no failure reasons.

## Measurement gaps addressed

- Added real-state quantization and occupancy reports, stable trainer splits,
  fixed evaluation seeds, phase timing, process/GPU probes, device
  microbenchmarks, machine-readable training metrics, and preflight.

## Remaining measurement gaps / nice-to-have

- `can_ko`, damage-fraction, and stat-stage summary retain conservative v1
  defaults because a Python/cartridge-equivalent damage estimate is not yet
  implemented. Unused categories are reported rather than treated as trained.
- Reflect, Light Screen, and Spikes *state* are not in schema v1. Their moves are
  covered, but active-field state requires a future schema migration.
- Python speed relation estimates the revealed opponent's speed from public
  species/level and neutral 31-IV assumptions; pokeemerald has exact active
  speed. This is documented approximation, not hidden-state access.
- `VanillaInspiredAgent` is not trustworthy yet—it remains equivalent to the
  damage heuristic and is excluded from fixed baseline claims.

## Reward audit

Only terminal win `+1`, loss `-1`, draw `0` is currently applied. Configured
faint and HP shaping coefficients are zero and no shaping code runs, so damage
farming, endless switching, and avoiding a winning KO cannot earn reward.
