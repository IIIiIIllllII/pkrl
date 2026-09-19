# Multi-worker rollout scaling

## Design

The learner remains the only owner of the PyTorch policy, value network, and
optimizer. For worker counts above one it creates a bounded `RolloutPool` of
Python processes. Each child owns one persistent Node process and runs one
BattleStream battle at a time. There is at most one outstanding battle command
per pipe, so rollout buffering cannot grow without bound.

At the beginning of each PPO generation, the learner broadcasts the 349 LUT
parameters and a monotonically increasing policy version. Workers create an
immutable NumPy actor, collect complete independent episodes, and return raw
trajectories with their old log probabilities. The learner waits for every
in-flight episode, rejects mixed policy versions or duplicate/cross-worker
battle IDs, computes per-episode GAE, concatenates the batch, and performs the
unchanged PPO update. Workers never optimize parameters.

Linux uses `fork` so read-only Python/PyTorch pages are shared; every child
starts its Node process only after the fork and never uses CUDA. Other systems
fall back to `spawn`.

## Determinism

Worker seeds and battle seeds use separate SHA-256-derived namespaces. Battle
seeds depend on the master seed and monotonically increasing battle index, not
completion order, so asynchronous worker timing cannot duplicate or alter the
assigned battle RNG stream. Every result records worker ID, worker seed,
Showdown battle seed, battle ID, and policy version.

## Failure and backpressure

Duplex pipes allow one in-flight job per worker. A timeout, closed pipe, worker
exception, version mismatch, duplicate ID, or illegal action fails loudly. The
training loop then writes an emergency checkpoint before propagating the
failure. Pool cleanup terminates remaining workers and any recorded Node child
that survived an abnormal worker exit.

## Worker selection

`benchmark-scaling` measures each requested count independently. The
recommendation is the smallest stable count whose decisions/second is within
97% of the maximum observed result. This avoids paying substantial memory and
operational cost for marginal throughput. CPU affinity remains disabled.

The local eight-logical-CPU sweep (three seconds per setting) measured 1,015,
2,023, 2,448, and 2,475 decisions/s at 1, 2, 4, and 8 workers respectively.
The rule selected four workers: it achieved 98.9% of the maximum while eight
workers increased sampled proportional-set memory by about 40% and reached 94%
system CPU.
These figures are local diagnostics, not predictions for a 16-vCPU Vast host.

A separate two-worker training dry run completed 127 battles and 1,628
decisions across six synchronous policy generations with zero illegal actions,
then reproduced its final generation from the 1,500-decision checkpoint and
completed both fixed evaluation suites.

## Metrics

Scaling reports include aggregate and per-worker throughput, startup and policy
sync time, queue wait, phase fractions, illegal actions, crash count, sampled
RAM/PSS, system CPU utilization, and optional `nvidia-smi` data. Training JSONL
adds policy version, worker idle estimate, learner queue-wait fraction, rollout
aggregation time, EMA throughput, and checkpoint/final ETA.
