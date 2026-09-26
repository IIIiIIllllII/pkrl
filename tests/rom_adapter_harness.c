#include "global.h"
#include "battle.h"
#include "pokemon.h"
#include "constants/pokemon.h"
#include "data/gen3rl/encoder.h"

struct BattlePokemon gBattleMons[4];
struct BattleResults gBattleResults;
u32 gBattleTypeFlags;
u8 gActiveBattler;
u16 gBattleWeather;
const struct SpeciesInfo gSpeciesInfo[3] = {
    [1] = {.types = {TYPE_WATER, TYPE_FLYING}, .baseSpeed = 81},
    [2] = {.types = {TYPE_GHOST, TYPE_STEEL}, .baseSpeed = 100},
};
static uint8_t captured[9][20];
void BattleAiRlScore(const uint8_t f[4][20], int16_t scores[4]) {
    memcpy(captured,f,4*20);
    memset(scores,0,4*sizeof(int16_t));
}
void BattleAIRL_ApplyMoveScores(s8 scores[4], bool8 augment);
const uint8_t *RunAdapter(int move, int hidden_speed) {
    s8 scores[4] = {100,0,0,0};
    memset(gBattleMons,0,sizeof(gBattleMons));
    memset(captured,0,sizeof(captured));
    gBattleMons[0].species=1; gBattleMons[0].hp=280; gBattleMons[0].maxHP=300;
    gBattleMons[0].speed=198; gBattleMons[0].moves[0]=move; gBattleMons[0].pp[0]=10;
    gBattleMons[0].hpIV=gBattleMons[0].attackIV=gBattleMons[0].defenseIV=31;
    gBattleMons[0].speedIV=gBattleMons[0].spAttackIV=gBattleMons[0].spDefenseIV=31;
    gBattleMons[1].species=2; gBattleMons[1].level=50; gBattleMons[1].hp=100; gBattleMons[1].maxHP=100;
    gBattleMons[1].speed=hidden_speed; gBattleResults.battleTurnCounter=2;
    BattleAIRL_ApplyMoveScores(scores,FALSE);
    return &captured[0][0];
}
