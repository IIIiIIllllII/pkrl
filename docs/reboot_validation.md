# Reboot validation — 2026-09-27

**Correctness/build/reproducibility ready; training-host performance pending.**
No 100M run was launched. The final benchmark ran on the developer's laptop,
not the borrowed training machine: its 8 logical CPUs produced 2409.6 steady
decisions/sec. That laptop result is a host-capacity observation, not a failure
of the learner correctness work. The performance gate remains intentionally
unresolved until the intended training host is benchmarked. Reserve
`v1.1-pretrain-ready` for the clean commit that passes that host benchmark;
`v1.1-audited` is an honest intermediate tag suggestion. No tag was created
during this pass.

1. **Repository found:** clean `main` / `origin/main` at `1a86b48`, no tags or
   other local branches. Existing provisional v1.1 code and prior READY report
   were present. Python, bridge, web, ROM, configs, tests and copied artifacts
   were inventoried before edits in `reboot_audit.md`. Historical artifacts
   were preserved, including the ignored 357 MB old run.
2. **Confirmed causes:** the old v1 semantics applied a generic chart to status
   moves and required both defender types to be immune. Existing v1.1 fixed
   these headline bugs but omitted special attacks. Further issues included
   inconsistent maybeTrapped masks, unguarded NumPy empty-mask argmax, hidden
   ROM target speed, stale deployed web code, a v1 LUT embedded in a v1.1 ROM
   patch, lossy 16-bit simulator seed construction, timing-dependent generation
   membership, unsaved sampling RNG, and partial-update recovery. The original
   current learner's measured bottleneck was repeated trainer-dataset parsing
   during dispatch, not PPO itself. No preserved cloud-only optimization was
   found or claimed to have been recovered verbatim.
3. **Schema:** `gen3-lut-v1.1` with mandatory semantics revision
   `2026-09-27-reboot`. Ordinary damage multiplies Gen 3 factors, any immunity
   wins; fixed/special damage uses relevant immunities only; status/self/field
   uses explicit applicability and a neutral sentinel, never generic damage
   weakness/resistance. Added Bide, OHKO, typeless Struggle and delayed attacks,
   variable-power attacks and Dream Eater rules. See `schema_v1_1.md` for
   represented conditions and simulator-authoritative limitations. Both v1
   and provisional v1.1 checkpoints are rejected, never reinterpreted.
4. **Layout/count:** 349 policy scalars: four action biases, 108 entries across
   20 categorical tables, 237 entries across five pair tables. The value
   network has 5249 training-only parameters. Exported quantized LUT is 349
   bytes. Switching logits remain zero; ROM switching stays vanilla.
5. **Added tests:** full chart, all Gen 3 move classes, masks, public semantics,
   feature IDs and absolute activated LUT IDs, float/integer scores and chosen
   actions; actual compiled ROM adapter; hidden-info counterfactuals; empty
   mask rejection; frozen policy log-probability checks; repeated generation
   determinism; GAE recurrence equality; batched preprocessing equivalence;
   RNG/Adam/value restore; failure after optimizer step followed by exact
   recovery, including an opponent snapshot; deployment-bundle/source parity.
6. **Results:** 91 Python tests and 42 web tests pass. TypeScript checks, server
   bundling and Vite production build pass. The isolated clone also passes all
   91 Python tests. Vite emits migration warnings about its future native
   config loader, but current builds pass.
7. **Parity:** 1138 stored public-observation fixtures, including every one of
   354 moves and typed Hidden Power variants, plus boundary/mask/status cases.
   Python/TypeScript features, masks, semantics, float scores and top-1 pass.
   Python/C public encoder, quantized scores and chosen action pass. Actual
   ROM adapter tested over all move catalog entries with two hidden-speed
   values. Full 17³ chart agrees with pinned Showdown. Separately, 5000/5000
   random integer C-score vectors are exact; float/quantized top-1 agreement
   is 99.50%, with quantization errors explicitly reported.
8. **Hidden information:** request-only observations; hidden moves, bench,
   item, unrevealed ability and future human choice cannot change tested
   features/decisions. Actual ROM speed is replaced with the public
   species/level estimate. Evaluation preserves policy and all training RNGs.
   Coverage: 209/349 entries sampled; Reflect, Light Screen and Spikes active
   state remain documented unrepresented features. Host-C tests do not imply
   ROM/emulator validation or parity after vanilla s8 score clamping.
9. **Original real-training profile:** 24 workers, rollout 4096, epochs 4,
   minibatch 1024, CPU/one torch thread. Initial profiled run: 8450 decisions,
   8.5656 training seconds (~987/sec); two PPO updates totaled 0.1334 sec.
   cProfile exposed 432 dataset loads and 369736 JSON decodes. An unprofiled
   checkout of `1a86b48` subsequently completed 33030 decisions in 25.565
   training seconds: 1292/sec overall and ~1361/sec after its first generation.
   The comparison uses identical algorithm settings; correctness changes mean
   the two implementations do not produce identical trajectories.
10. **Performance changes:** cache parsed cartridge choices with mtime-based
    invalidation and copy isolation; remove per-battle manifest writes; build
    one generation batch/value input; perform GAE without per-scalar torch
    dispatch; reuse float value inputs/parameter lists in PPO. No PPO objective,
    clipping, normalization, epoch count, minibatch, reward or mixture change.
    Every generation records dispatch/wait/sync, preprocessing, GAE, conversion,
    PPO epoch, forward/backward/clip/Adam and metrics timings. Checkpoint/eval
    checks are also timed. Benchmarks disable scheduled checkpoint/evaluation
    work and start with an empty clean opponent pool, as initial training does.
11. **Final real-training measurement on the developer laptop** at code commit `9c1277f`: 32994
    decisions, eight PPO updates, 253 policy parameters changed, zero illegal
    actions, no NaN/Inf. 16.630 sec end-to-end: **1984 decisions/sec**;
    training-only **2130/sec**; excluding generation one **2410/sec**.
    Host CPU utilization 88.1%. Worker idle 53.5%, learner wait 88.0% of
    generation wall time. Mean later-generation preprocessing ~0.010 sec,
    dispatch 0.079 sec, synchronization 0.0038 sec, wait 1.495 sec, PPO 0.0583
    sec (forward 0.0263, backward 0.0193, clip 0.0028, Adam 0.0080). Per-epoch
    times ~0.014 sec. An earlier isolated optimized measurement reached 2641
    steady decisions/sec; the final gate uses its own measured 2410/sec.
    This does not reproduce or certify historical 5400–5600/sec throughput,
    because that target belongs to the borrowed training machine.
12. **Bootstrap:** successful isolated clone of this repository with a new
    virtualenv, downloaded pinned upstreams, locked dependencies and generated
    bridge/web/ROM host prerequisites. Clean-clone testing exposed a missing
    generated map header; the fix is committed in `9c1277f`, and isolated tests
    then all passed. No manual patches were needed. Runtime/dependency pins
    and exact upstream commits are in `reboot_runbook.md` and lockfiles. No
    changes were pushed to GitHub; publish the local commits before cloning
    this revision from GitHub.
13. **Fresh-machine preflight**, after installing documented prerequisites and
    cloning the published revision:

    ```bash
    bash scripts/bootstrap.sh
    bash scripts/preflight.sh --config configs/train_v1_1_100m.yaml
    ```

14. **Fresh-machine real PPO benchmark**, after bootstrap:

    ```bash
    bash scripts/benchmark_real_train.sh --config configs/train_v1_1_100m.yaml --decisions 32768
    ```

15. **Command that would launch clean 100M**, only after the exact clean
    commit/config/runtime passes preflight; not executed:

    ```bash
    OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
      .venv/bin/python -m gen3rl.cli train --config configs/train_v1_1_100m.yaml
    ```

16. **Verdict:** CORRECTNESS/REPRODUCIBILITY READY; TRAINING-HOST PERFORMANCE
    PENDING. The local preflight's only failed gate is the laptop's throughput
    measurement. Benchmark the intended borrowed host before approving the
    ready tag. Documentation commits after `9c1277f` do not change the tested
    code, but the gate intentionally requires a new preflight for any new
    commit. The 100M configuration is prepared with no resume or contaminated
    initialization; no long run was started.

Implementation commits: `0cb86e0` audit, `d4f55d3` canonical semantics/parity and
optimized deterministic learner, `f7beb95` pinned workflow, `5e6cff3` deployed
bundle parity, `9c1277f` clean-clone header generation. Runtime reports live in
ignored `artifacts/reports/reboot/`; this committed report preserves the
findings independently of temporary machines and runtime outputs.
