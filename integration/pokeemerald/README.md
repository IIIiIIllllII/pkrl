# pokeemerald integration

The working integration is applied directly to `third_party/pokeemerald`:

- `include/config.h`: `BATTLE_AI_MODE_{VANILLA,RL_AUGMENT,RL_REPLACE}`
- `include/battle_ai_rl.h`
- `src/battle_ai_rl.c`
- hook in `src/battle_ai_script_commands.c`
- generated LUT under `src/data/battle_ai_rl_lut.{h,c}`

Only normal trainer singles are eligible. Existing switch/item decisions, legality
filtering, special battles, doubles, and the vanilla scripts remain intact.

The third-party checkout is intentionally excluded from the project Git
repository. After `bootstrap` clones the pinned official upstream, apply the
tracked integration patch with:

```bash
git -C third_party/pokeemerald apply ../../integration/pokeemerald/gen3rl.patch
```
