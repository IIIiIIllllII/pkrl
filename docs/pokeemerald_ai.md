# pokeemerald Battle AI findings

`BattleAI_SetupAIData` initializes selected move scores to 100 and zeros moves
rejected by `CheckMoveLimitations(..., MOVE_LIMITATIONS_ALL)`. `AI_ThinkingStruct`
stores four `s8` scores. Singles run each enabled script in
`data/battle_ai_scripts.s`; score commands add signed bytes and flatten negative
results to zero. `ChooseMoveOrAction_Singles` selects the maximum and breaks exact
ties uniformly with `Random()`.

Switch/item choice is handled before or around this scoring path in existing AI
code and is not replaced. Doubles have a separate target-and-move loop. Special
flags select Safari, roaming, first-battle, factory/frontier and other scripts.

Trainer parties come from the four structs in `include/data.h`. In
`CreateNPCTrainerParty` the exact fixed IV is `partyData[i].iv * 31 / 255`, passed
to `CreateMon`. Custom moves overwrite all four move/PP slots. Default moves are
created by `CreateMon` and `GiveBoxMonInitialMoveset`, which walks the species'
level-up learnset through the trainer's level, deleting the oldest move when
more than four have been learned.

The RL hook runs inside singles after setup. Replace mode skips scripts only for
supported trainer singles; augment mode runs scripts then adds the LUT. Zeroed
legality scores and empty slots remain zero. Results are widened, clamped to
1–127, then stored in `s8`.

