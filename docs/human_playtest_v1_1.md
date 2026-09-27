# Human playtest readiness — clean `gen3-lut-v1.1`

Purpose: obtain trustworthy human playtest data from the clean v1.1 policy
before v2 is designed. No retraining, no v2, no weight changes, no simulator
mechanics changes.

## Clean run and checkpoints

Run `20260926-160543-1c6977`, located at
`new run 1.1/runs/gen3-lut-v1.1/20260926-160543-1c6977/` (gitignored;
provenance copied to
`artifacts/gen3-lut-v1.1/clean-run-20260926-160543-1c6977/`).

- 100,000,137 decisions, 15,444,467 battles, 23,525 PPO updates
- 0 illegal actions, `interrupted: false`, clean tree (`git_dirty: false`)
- 24 rollout workers, CPU, 1 intra-op / 1 inter-op PyTorch thread
- 31,952.8 s wall time (8 h 52 m 33 s)
- schema `gen3-lut-v1.1`, semantics `2026-09-27-reboot`, 349 parameters / 349 bytes
- Showdown `2ddfa0476f8207e12e204b1c69f7c7683b17633c`, format `gen3customgame`

Exported checkpoints, with SHA-256 recorded inside each web asset:

| policy ID | checkpoint | decisions | SHA-256 (prefix) |
| --- | --- | ---: | --- |
| `v1.1-20m` | `checkpoints/decision_20000000.pt` | 20,002,836 | `8697e226a261c4b0` |
| `v1.1-50m` | `checkpoints/decision_50000000.pt` | 50,003,950 | `1a4b2d94c12dbb70` |
| `v1.1-100m` | `checkpoints/decision_100000000.pt` | 100,000,137 | `450c15c548effe28` |

`final.pt` holds identical policy weights to `decision_100000000.pt`; the
milestone file is used so the asset names an unambiguous decision count.

## Contaminated v1 exclusion

The old `gen3-lut-v1` 100M run (`20260919-173958/`, schema `gen3-lut-v1`) and its
web assets are excluded structurally, not by convention:

- `find_run()` in `scripts/export_web_policies.py` requires
  `feature_schema_version == gen3-lut-v1.1` **and** the audited semantics
  revision; `validate_checkpoint_schema` refuses v1 weights outright.
- The three v1 browser assets and the v1 parity oracle moved to
  `web-playtest/quarantine/contaminated-v1/`, outside anything Vite serves.
- `web-playtest/src/policy/legacyV1Encoder.ts`, which reproduced the
  contaminated encoding (including the dual-type `every` immunity bug), was
  deleted along with the `legacy*` fields it needed. No code path can score a v1
  asset any more.
- `/api/battle` rejects `v1-10m` / `v1-50m` / `v1-100m` by name before doing any
  work, and the policy registry is asserted equal to the permitted clean set.
- Tests: quarantined assets fail `validatePolicy` and
  `assertCleanCheckpointPolicy` (including a forged `schema_version`), are absent
  from `public/`, and no shipped module may import, fetch or register one.

## Regression coverage

`scripts/regression_cases.py` is the single source of the 21 required states,
built from the pinned Gen 3 move catalog so Python and the browser see identical
move metadata. Both parity generators and both test suites consume it.

| group | cases |
| --- | --- |
| damaging immunity | Earthquake→Skarmory, Thunderbolt→Swampert, Cross Chop→Gengar, Psychic→Tyranitar, Sludge Bomb→Metagross |
| positive effectiveness | Ice Beam→Salamence 4x, Flamethrower→Scizor 4x |
| status not charted | Dragon Dance, Swords Dance, Recover, Protect, Growl, Confuse Ray |
| status applicability | Thunder Wave→Ground, Toxic→Steel, Toxic→Poison, Will-O-Wisp→Fire, Leech Seed→Grass |
| fixed damage | Seismic Toss→Ghost, Night Shade→Normal |
| playtest regression | Gyarados must not prefer immune Earthquake into Skarmory |

The Gyarados/Skarmory regression is asserted three ways: the encoded
effectiveness must be `immune`; no real checkpoint may rank Earthquake top-1 in
that state (Python and TypeScript); and no checkpoint may use Earthquake across
a live multi-turn battle against Skarmory. Where a checkpoint were to fail, the
test prints the immune move's LUT contributions rather than adjusting the type
logic.

Observed scores in the fixture state (Earthquake, Double-Edge, Dragon Dance,
Roar, switch):

| checkpoint | Earthquake | top-1 |
| --- | ---: | --- |
| `v1.1-20m` | −2.063 | switch (0.0) |
| `v1.1-50m` | −3.880 | switch (0.0) |
| `v1.1-100m` | −5.782 | switch (0.0) |

Earthquake's score falls monotonically with training, which is the intended
effect of the corrected effectiveness encoding.

## Hidden-information boundary

The AI sees only its own `|request|` plus the public battle protocol. Tests
assert: identical first decisions under counterfactual human item/ability/bench
and future choice; the observation exposes exactly
`turn, own_active, target, weather, moves, available_switch_count` with the
target limited to `species, hpBucket, status, types, estimatedSpeed`; unrevealed
opponent species, abilities and items never appear in the serialized response;
AI switch options stay anonymized mid-battle; and `answer_availability` analysis
is withheld until the battle is terminal.

Separately from that observation, every AI decision and human action carries a
`public_state` snapshot (weather and turns remaining, both actives' HP/status,
stat stages and volatiles, screens/Spikes, revealed Pokémon). It is rebuilt only
from that player's own protocol stream, never reaches the encoder, and exists so
analysis can tell a state-dependent decision from a bad one — notably because
v1.1's `feature_stage_summary` is constant, so the policy never sees stat stages.

## Known limitations

- Blinding is a UI convention. The stateless replay API carries the policy ID in
  every request, so a determined tester can read it from network traffic. The log
  always records the true checkpoint.
- `answer_availability` is availability bookkeeping, not a strategic oracle: it
  ignores Substitute, items, abilities, speed tiers and damage rolls.
- `feature_damage_fraction`, `feature_can_ko` and `feature_stage_summary` are
  constants in v1.1 (0, 0, `zero`), exactly as in training. Setup pressure is
  therefore invisible to the policy, which is a v2 design input, not a bug.
- A full battle log is roughly 320 KB (about 14 KB per AI decision), so the
  `localStorage` archive holds on the order of fifteen battles. A failed save is
  reported in the UI rather than swallowed; download battles as you go.
- Switch logits are a constant zero, so the policy switches whenever all move
  scores are negative.
- The team fixture pool is deliberately small (seven fixtures) and is a
  behavioural probe, not a benchmark.
