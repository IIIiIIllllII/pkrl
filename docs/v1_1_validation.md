# V1.1 pre-training validation

Validated on 2026-09-22 without starting a long run:

- Python: 60 tests passed.
- TypeScript/web: 40 tests passed; production Vite/Vercel build passed.
- Python/TypeScript fixtures: exact feature IDs and legal masks, float scores
  within strict tolerance, identical top-1 on six requested matchup fixtures.
- Python/generated C: 5,000/5,000 integer score vectors exactly equal; the
  smoke export had 99.68% float/quantized top-1 agreement.
- Hidden-information tests: unrevealed party species, moves, abilities, items,
  and exact opponent HP remained absent.
- Short training: 1,600 decisions, 166 battles, seven PPO updates, 240/349
  parameters changed, zero illegal actions, no NaN/Inf.
- Short post-training evaluation: eight games across random and damage
  baselines, zero illegal actions.
- Full preflight: `READY FOR LONG RUN`, no failure reasons. The validation host
  exposed 8 logical CPUs while the production config requests 24 workers, so
  its 24-worker throughput result is only a functional check, not the expected
  24-worker machine throughput.

The committed coverage report retains warnings for low-HP self-KO sampling and
for Reflect/Light Screen/Spikes active-state fields that are intentionally not
part of v1.1. These are coverage/schema limitations, not failures of the fixed
effectiveness semantics.
