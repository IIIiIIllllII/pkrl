#include "global.h"
#include "battle.h"
#include "battle_ai_rl.h"
#include "pokemon.h"
#include "data/battle_ai_rl_lut.h"
#include "data/gen3rl/encoder.h"
#include "data/gen3rl/semantics.generated.h"
#include "constants/battle.h"
#include "constants/moves.h"
#include "constants/pokemon.h"

#if !defined(RL_FEATURE_SCHEMA_REVISION) || RL_FEATURE_SCHEMA_REVISION != 101
#error "Battle AI encoder requires a gen3-lut-v1.1 LUT"
#endif

static u8 StatusBucket(u32 status)
{
    if (status & STATUS1_BURN) return 1;
    if (status & STATUS1_PARALYSIS) return 2;
    if (status & (STATUS1_POISON | STATUS1_TOXIC_POISON)) return 3;
    if (status & STATUS1_SLEEP) return 4;
    if (status & STATUS1_FREEZE) return 5;
    return 0;
}

static u8 TypeSchemaId(u8 type)
{
    static const u8 map[] = {0,6,9,7,8,12,11,13,16,17,1,2,4,3,10,5,14,15};
    return type < ARRAY_COUNT(map) ? map[type] : 17;
}

bool8 BattleAIRL_IsSupported(void)
{
    const u32 excluded = BATTLE_TYPE_DOUBLE | BATTLE_TYPE_LINK | BATTLE_TYPE_SAFARI
        | BATTLE_TYPE_ROAMER | BATTLE_TYPE_FIRST_BATTLE | BATTLE_TYPE_BATTLE_TOWER
        | BATTLE_TYPE_FRONTIER | BATTLE_TYPE_EREADER_TRAINER | BATTLE_TYPE_SECRET_BASE
        | BATTLE_TYPE_INGAME_PARTNER | BATTLE_TYPE_RECORDED_LINK;
    return (gBattleTypeFlags & BATTLE_TYPE_TRAINER) && !(gBattleTypeFlags & excluded);
}

void BattleAIRL_ApplyMoveScores(s8 moveScores[MAX_MON_MOVES], bool8 augment)
{
    u8 i, target = BATTLE_OPPOSITE(gActiveBattler);
    RlPublicObservation o = {0};
    u8 features[9][20], mask[9];
    s16 scores[4];
    o.hp = gBattleMons[gActiveBattler].hp;
    o.max_hp = gBattleMons[gActiveBattler].maxHP;
    /* Public HP bar only: replicate the opponent protocol's rounded percent. */
    {
        u32 hp = gBattleMons[target].hp, max = gBattleMons[target].maxHP;
        u32 percent = max ? (hp * 100 + max - 1) / max : 0;
        o.target_hp_bucket = percent == 0 ? 0 : percent <= 25 ? 1 : percent <= 50 ? 2 : percent <= 75 ? 3 : 4;
    }
    o.own_status = StatusBucket(gBattleMons[gActiveBattler].status1);
    o.target_status = StatusBucket(gBattleMons[target].status1);
    o.own_speed = gBattleMons[gActiveBattler].speed;
    /* Species and level are public. Never inspect the opponent's actual speed. */
    o.estimated_target_speed = ((2 * gSpeciesInfo[gBattleMons[target].species].baseSpeed + 31)
        * gBattleMons[target].level) / 100 + 5;
    for (i = 0; i < 2; i++)
    {
        /* v1.1 observes species types; volatile type changes are not tracked. */
        o.own_types[i] = TypeSchemaId(gSpeciesInfo[gBattleMons[gActiveBattler].species].types[i]);
        o.target_types[i] = TypeSchemaId(gSpeciesInfo[gBattleMons[target].species].types[i]);
    }
    o.turn = gBattleResults.battleTurnCounter + 1;
    o.weather = (gBattleWeather & B_WEATHER_SUN) ? 1 : (gBattleWeather & B_WEATHER_RAIN) ? 2
        : (gBattleWeather & B_WEATHER_SANDSTORM) ? 3 : (gBattleWeather & B_WEATHER_HAIL) ? 4 : 0;
    for (i = 0; i < 4; i++)
    {
        u16 move = gBattleMons[gActiveBattler].moves[i];
        o.moves[i] = move;
        o.types[i] = rl_move_metadata[move][0]; o.powers[i] = rl_move_metadata[move][1];
        o.accuracy[i] = rl_move_metadata[move][2]; o.priority[i] = rl_move_metadata[move][3];
        o.pp[i] = gBattleMons[gActiveBattler].pp[i]; o.disabled[i] = moveScores[i] == 0;
        if (move == MOVE_HIDDEN_POWER)
        {
            struct BattlePokemon *p = &gBattleMons[gActiveBattler];
            u8 bits = (p->hpIV & 1) | ((p->attackIV & 1) << 1) | ((p->defenseIV & 1) << 2)
                | ((p->speedIV & 1) << 3) | ((p->spAttackIV & 1) << 4) | ((p->spDefenseIV & 1) << 5);
            u8 type = 15 * bits / 63 + 1;
            if (type >= TYPE_MYSTERY) type++;
            o.types[i] = TypeSchemaId(type);
            bits = ((p->hpIV & 2) >> 1) | (p->attackIV & 2) | ((p->defenseIV & 2) << 1)
                | ((p->speedIV & 2) << 2) | ((p->spAttackIV & 2) << 3) | ((p->spDefenseIV & 2) << 4);
            o.powers[i] = 40 * bits / 63 + 30;
        }
    }
    RlEncodePublic(&o, features, mask);
    BattleAiRlScore(features, scores);
    for (i = 0; i < 4; i++)
    {
        s32 value;
        if (!mask[i]) continue;
        value = (augment ? moveScores[i] : 64) + scores[i];
        if (value < 1) value = 1;
        if (value > 127) value = 127;
        moveScores[i] = (s8)value;
    }
}
