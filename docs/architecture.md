# Architecture

Python owns rollout collection, masked PPO, the additive LUT policy, quantization,
evaluation, and export. One persistent Node process owns a map of Showdown
`BattleStream` objects and exchanges JSONL commands (`ping`, `reset`, `act`,
`close`). A process is never spawned per battle.

The deployable policy is a sum of one-dimensional categorical tables and five
small pairwise tables. The training-only value model is a 64-unit MLP. Switch
actions occupy universal indices 4–8 during experiments but have separate,
neutral logits and are not exported in ROM v1.

Export produces float NPZ, quantized JSON, a manifest, and host-compilable C.
Integer accumulation uses 32 bits and explicitly saturates to signed 16 bits.
The pokeemerald adapter converts live battle state to the generated schema and
adjusts only scores that survived the engine's legality filter.

