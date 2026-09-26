# pokeemerald integration

The working integration is applied directly to `third_party/pokeemerald`:

- `include/config.h`: `BATTLE_AI_MODE_{VANILLA,RL_AUGMENT,RL_REPLACE}`
- `include/battle_ai_rl.h`
- `src/battle_ai_rl.c`
- hook in `src/battle_ai_script_commands.c`
- generated LUT under `src/data/battle_ai_rl_lut.{h,c}`

The patch ships a zero-weight revision 101 template, never historical weights.
Bootstrap also installs the shared public-observation encoder from
`integration/reference/` and top-level compilation units for encoder and LUT.
The semantic constants are generated from Python. Replace the zero LUT with
a clean v1.1 export for deployment. `tests/test_c_encoder.py` compiles the
actual adapter and compares all 354 moves with Python on the host.

Only normal trainer singles are eligible. Existing switch/item decisions, legality
filtering, special battles, doubles, and the vanilla scripts remain intact.

The third-party checkout is intentionally excluded from the project Git
repository. Install or upgrade the exact historical integration with:

```bash
.venv/bin/python -m gen3rl.cli bootstrap
```
