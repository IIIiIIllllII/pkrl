# Clean `gen3-lut-v1.1` 100M run — provenance

Small, reviewable artifacts copied from the completed clean run
`20260926-160543-1c6977`. The 136 MB of PyTorch checkpoints stay outside git
(see `/new run 1.1/` in `.gitignore`); `scripts/export_web_policies.py` records
each checkpoint's SHA-256 in the exported web assets, and
`tests/test_web_policy_assets.py` re-verifies those digests whenever the run
directory is present.

| fact | value |
| --- | --- |
| decisions | 100,000,137 |
| battles | 15,444,467 |
| PPO updates | 23,525 |
| illegal actions | 0 |
| interrupted | false |
| rollout workers | 24 (CPU, 1 intra-op / 1 inter-op thread) |
| wall time | 8 h 52 m 33 s (31,952.8 s) |
| final LUT | 349 int8 parameters = 349 bytes |
| schema | `gen3-lut-v1.1`, semantics `2026-09-27-reboot` |
| Showdown | `2ddfa0476f8207e12e204b1c69f7c7683b17633c`, `gen3customgame` |
| training-host project commit | `3db0a3737f956665f81fffad466c8549e3b0b83e` |

Milestone win rates (500 games per opponent) are in `evaluations/`.
