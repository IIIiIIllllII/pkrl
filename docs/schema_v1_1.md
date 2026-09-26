# `gen3-lut-v1.1` feature semantics

V1.1 keeps the v1 table layout (20 categorical features, five pair tables,
349 trainable scalars) but corrects the meaning of feature 8,
`effectiveness`. The unchanged size does **not** make v1 weights compatible:
checkpoint metadata is mandatory and v1 loads are rejected.
The audited contract also requires `semantics_revision: 2026-09-27-reboot`.
Earlier provisional v1.1 smoke checkpoints are rejected, so their incomplete
special-move semantics cannot be silently reused either.

Feature 8 is an applicability/effectiveness category in v1.1:

- normal damage: the full Gen 3 type chart (`0`, `1/4`, `1/2`, `1`, `2`, `4`);
- fixed/special damage: `immune` or `neutral` only; and
- status/self/field/support: `immune` only for a represented, public,
  mechanics-specific failure, otherwise `neutral`.

All chart lookups use the Gen 3 chart. This matters for Dark and Ghost versus
Steel, which are resisted in Gen 3 but neutral in later generations.

The represented status failures are Thunder Wave and Glare type immunity,
Poison/Steel immunity to poison and Toxic, Fire immunity to burn, Grass
immunity to Leech Seed, an existing primary status blocking another primary
status, and Nightmare requiring sleep. Abilities, held items, Substitute, and
untracked volatile state are intentionally not inferred.

The fixed/special-damage set is Counter, Dragon Rage, Endeavor, Mirror Coat, Night
Shade, Psywave, Seismic Toss, SonicBoom, Super Fang, Bide, Fissure, Guillotine,
Horn Drill, Sheer Cold, Future Sight and Doom Desire. Immunity is retained,
but weaknesses and resistances are not. Callback-powered Flail, Frustration,
Hidden Power, Low Kick, Return, Reversal, Magnitude, Present and Spit Up remain normal damage. Hidden
Power's resolved Gen 3 type and power are used.

The generated C header embeds `RL_FEATURE_SCHEMA "gen3-lut-v1.1"`. The ROM
adapter implements the same three move classes and applicability rules before
calling the generated integer scorer.

Reboot audit additions (2026-09-27): Struggle and Gen 3 delayed Future Sight /
Doom Desire damage are typeless for effectiveness. Dream Eater requires a
sleeping target. Bide's Gen 3 release respects Ghost immunity. OHKO moves use
immunity-only buckets; level/accuracy restrictions are not damage multipliers.
Sheer Cold has no later-generation Ice immunity. Glare cannot paralyze Ghost
in Gen 3. Electric types can be paralyzed in this generation. Soundproof,
Levitate, Wonder Guard and other hidden ability effects must not be guessed.
Pain Split remains status/support. Status self/field moves do not consult the
opponent's status. Conditional damage execution (Counter, Mirror Coat, Bide,
Endeavor, stockpile, protection, accuracy) remains simulator-authoritative.
`applicable` means "no represented public failure", not guaranteed success.

Status/support does not activate a damage-chart weakness/resistance category.
For the fixed 20-category layout its feature 8 value is the explicit neutral
sentinel (3), or the public failure sentinel (0). This does not claim 1x damage.

Python is normative. Stored fixtures cover all 354 moves against three target
type combinations plus named regressions. The entire 17³ attack/ordered dual
type chart is checked against pinned Showdown. The portable C encoder is used
by the ROM adapter; its static semantic tables are generated from Python.
The ROM remains restricted to move selection in normal singles; vanilla owns
switching/items, and its s8 score clamp is a deployment limitation, not a
claim of full battle-policy equivalence. No GBA toolchain/ROM execution result
is implied by host-C parity.
