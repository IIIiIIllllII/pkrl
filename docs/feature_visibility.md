# Feature visibility and runtime cost

| Feature | Showdown source | pokeemerald source | Visibility | ROM cost |
|---|---|---|---|---|
| own HP/status | player `request.side.pokemon` | `gBattleMons[user]` | private/self | O(1) |
| target HP/status | player-visible protocol; omitted until tracked | `gBattleMons[target]` | public / engine-known | O(1) |
| move, PP, disabled | `request.active[0].moves` | move slots after `CheckMoveLimitations` | private/self | O(1) |
| move type/power/accuracy/priority | request plus Dex metadata | `gBattleMoves` | public/constant | O(1) |
| STAB | own revealed typing | battler types | self / engine-known | O(1) |
| effectiveness | public active species/types | `gTypeEffectiveness` | public / engine-known | small table scan |
| speed relation | omitted/neutral in strict request-only training v1 | active battler speeds | cartridge internal | two loads |
| weather/side conditions | player-visible protocol; neutral in v1 | battle globals/side timers | public | O(1) |
| can-KO/damage fraction | conservative disabled bucket in v1 | future reuse of AI damage helper | engine-known | deferred |

Unrevealed opponent party species, moves, items, abilities, exact HP, EVs, and
party contents never enter the JSON observation. Tests use distinct secret
species and search the serialized p1 request to enforce this boundary.

