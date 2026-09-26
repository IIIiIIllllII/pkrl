#ifndef GEN3RL_PUBLIC_ENCODER_H
#define GEN3RL_PUBLIC_ENCODER_H
#include <stdint.h>
/* Only normalized player-visible fields. No simulator/ROM object pointers.
 * type IDs and status IDs are the Python schema's IDs; -1 means absent type.
 * accuracy -1 means always hit. move 0 is an empty slot. */
typedef struct {
    int32_t moves[4], types[4], powers[4], accuracy[4], priority[4], pp[4], disabled[4];
    int32_t own_types[2], target_types[2];
    int32_t hp, max_hp, target_hp_bucket, own_status, target_status;
    int32_t own_speed, estimated_target_speed, weather, turn;
    int32_t switch_count, forced_switch, trapped, wait;
} RlPublicObservation;
void RlEncodePublic(const RlPublicObservation *o, uint8_t features[9][20], uint8_t mask[9]);
#endif
