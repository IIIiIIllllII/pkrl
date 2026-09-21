# `gen3-lut-v1.1` feature semantics

V1.1 keeps the v1 table layout (20 categorical features, five pair tables,
349 trainable scalars) but corrects the meaning of feature 8,
`effectiveness`. The unchanged size does **not** make v1 weights compatible:
checkpoint metadata is mandatory and v1 loads are rejected.

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

The fixed-damage set is Counter, Dragon Rage, Endeavor, Mirror Coat, Night
Shade, Psywave, Seismic Toss, SonicBoom, and Super Fang. Immunity is retained,
but weaknesses and resistances are not. Callback-powered Flail, Frustration,
Hidden Power, Low Kick, Return, and Reversal remain normal damage. Hidden
Power's resolved Gen 3 type and power are used.

The generated C header embeds `RL_FEATURE_SCHEMA "gen3-lut-v1.1"`. The ROM
adapter implements the same three move classes and applicability rules before
calling the generated integer scorer.
