# Completed v1 run contamination audit

The copied run `20260919-173958` is a historical baseline and is labeled
`gen3-lut-v1-buggy / contaminated-type-effectiveness`. It has not been edited
or deleted.

## Confirmed execution path

The 100,000,182-decision run records project commit
`72e6b5c8e2963660605f15912c888e8842001a7c`, schema `gen3-lut-v1`, and pinned
Showdown commit `2ddfa0476f8207e12e204b1c69f7c7683b17633c`. Both single- and multiworker
rollouts called `runner.battle()`, received player-filtered requests from
`showdown_bridge/src/worker.ts`, and passed them to
`gen3rl.features.encoder.encode_request()`. Evaluation and real-state
calibration used the same battle/encoder path.

At that commit the worker calculated a damage-chart bucket for every move. Its
dual-type immunity test used `every`, so one immune defender type was discarded
unless both types were immune. Python trusted that bucket without
recomputation. The worker also called the unscoped current-generation `Dex`
type chart instead of `Dex.mod('gen3')`; in particular, Dark and Ghost attacks
against Steel were encoded as neutral instead of Gen 3's resistance.
Consequently status, setup, recovery, protection, weather,
field, phazing, pivot and utility candidates could activate resistance,
weakness or immunity categories. Fixed-damage moves could activate resistance
or weakness categories. Typed Hidden Power was also collapsed to the base Dex
entry on the training path.

The directly affected scalar ranges in the exported 349-entry LUT are
`feature_effectiveness` offsets 57–62 and
`pair_effectiveness_move_role` offsets 112–189. In the latter table, the wrong
cells are the non-neutral effectiveness rows paired with non-damage roles;
fixed damage should only use immune or neutral. Other tables were indirectly
optimized against those corrupted observations.

All v1 checkpoints, milestone/quick evaluations, `metrics.jsonl`, float LUT,
quantized LUT, manifest, and generated C are contaminated because they derive
from that run. The old web adapter separately had the dual-immunity and typed
Hidden Power defects; those were not identical to the training defect after
the web-only fixes. The web app now isolates old policies behind an explicit
legacy v1 encoder and uses v1.1 semantics for new encoder/parity work.

## Measurable frequency

Historical rollout observations were not retained, so an exact 100M-state
fraction cannot be recovered and is not estimated. The committed seeded audit
replayed the frozen 100M policy over 10,000 fresh synthetic states. It measured
35,275 legal move candidates: 8,527 (24.17%) changed in at least one encoded
feature, 6,711 (19.02%) changed effectiveness, 4,079 states (40.79%) contained
an effectiveness change, the legacy-selected action carried a changed
effectiveness feature in 1,420 states (14.20%), and rescoring the old weights
with v1.1 features changed top-1 in 1,045 states (10.45%). This is a
reproducible proxy, not a claim about
the historical rollout distribution; see
`artifacts/audits/v1_contamination_proxy.json`. Its damage-role differences
include both the dual-immunity defect and the current-Dex-versus-Gen-3 Steel
resistance defect.
