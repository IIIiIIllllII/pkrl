# Human vs. clean `gen3-lut-v1.1` playtest

This app runs human-vs-policy Gen 3 battles to collect qualitative evidence
about the **clean** `gen3-lut-v1.1` policy before v2 is designed. It supports
blind 20M/50M/100M checkpoint selection, legal moves and switches, turn flags, a
short end survey, a developer view with LUT feature contributions, local
persistence, and single-battle or session JSON/JSONL exports.

## Only clean v1.1 policies are loadable

The three served assets come from the completed clean run
`20260926-160543-1c6977` (100,000,137 decisions, 15,444,467 battles, 23,525 PPO
updates, zero illegal actions, not interrupted):

| policy ID | milestone | decisions | vs random | vs damage |
| --- | ---: | ---: | ---: | ---: |
| `v1.1-20m` | 20,000,000 | 20,002,836 | 78.6% | 61.6% |
| `v1.1-50m` | 50,000,000 | 50,003,950 | 78.2% | 62.2% |
| `v1.1-100m` | 100,000,000 | 100,000,137 | 78.6% | 63.8% |

Each asset carries its schema, semantics revision, source checkpoint path and
SHA-256, training counters, quantization mode/scale, the pinned Showdown commit
and the training-host project commit. `assertCleanCheckpointPolicy` rejects
anything that fails those checks, including an asset whose declared table
offsets disagree with the canonical 349-parameter layout.

The contaminated `gen3-lut-v1` generation is **quarantined** in
[`quarantine/contaminated-v1/`](quarantine/contaminated-v1/README.md), outside
`public/`, so Vite never serves it and nothing in `src/`, `server/` or `api/`
imports it. Passing a v1 policy ID to `/api/battle` is rejected with an explicit
error, and `tests/test_web_policy_assets.py` fails if any shipped module ever
references one again.

## Architecture and parity

The browser owns the React UI, local research archive, and downloads. A
stateless `/api/battle` function deterministically replays the submitted human
choice history and selects AI actions. No battle database or persistent server
state is required.

Pokémon Showdown cannot be safely bundled into a browser unchanged: its Dex
loads formats and generation data through Node's filesystem and dynamic
`require`. The serverless function therefore uses the exact compiled runtime
from training commit `2ddfa0476f8207e12e204b1c69f7c7683b17633c`, vendored under
`vendor/pokemon-showdown`. The same-numbered npm release was checked and is not
byte-identical, so it is deliberately not used for mechanics.

Python is the reference implementation. The TypeScript encoder, float32 scorer,
int8 scorer, activated feature IDs and per-term contributions are all pinned to
it by fixtures generated from the real checkpoints:

- `tests/fixtures/v1-1-parity-fixtures.json` — 1,138 broad categorical cases
  (every pinned Gen 3 move against three type pairs, HP/status/mask boundaries).
- `tests/fixtures/v1-1-regression-fixtures.json` — the 21 required regression
  states, each evaluated against all three real checkpoints.

Categorical values (move classification, resolved defender types, applicability,
effectiveness bucket, feature IDs, legal mask) must match exactly. Float scores
match to 1e-6; `Math.fround` reproduces NumPy's float32 rounding at every
accumulation step. Quantized int8 scores match **exactly**, and the 100M
asset's 349 int8 bytes are byte-identical to the exported ROM LUT.

AI observations are rebuilt only from the AI player's `|request|` and public
battle protocol. Mid-battle responses omit unrevealed party members, items,
abilities and simulator internals, and AI switch options are anonymized as
"Switch option N". Debug mode shows policy features and scores, not omniscient
battle state.

The float32 LUT path matches training inference and keeps v1.1's neutral zero
switch logits. The policy therefore switches whenever every learned move score
is below zero; this reproduces the training/evaluation policy and is not v2
switching logic.

## Blind checkpoint testing

Normal mode picks one of the three clean checkpoints uniformly at random
(rejection sampling, so there is no modulo bias), keeps it out of the UI, and
reveals it only when the battle ends. The active checkpoint is always recorded
in the research log as `metadata.hidden_policy_id`. Developer mode disables
blinding and selects a checkpoint explicitly.

## Research logging

Every AI decision records: battle ID, turn, policy checkpoint, public
observation, legal actions, legal action mask, every legal action's float and
int8 LUT score, chosen action, top-1/top-2 scores and margin, activated global
feature IDs, per-term LUT contributions, move role, move classification,
applicability, effectiveness, resolved defender types, and the visible battle
events that followed. Human actions and the public battle log are recorded
alongside. Hidden simulator state is never mixed in
(`metadata.hidden_debug_state_included` is always `false`).

To help separate an AI mistake from a team gap, each decision also gets an
`answer_availability` block once the battle is over, classifying the turn as
`answer_used`, `active_answer_unused`, `bench_answer_unused` or
`no_answer_existed`. It is shallow bookkeeping over the AI's own side — legal
super-effective damage, phazing, self-KO, applicable disabling status, plus the
same test over switch-legal bench movesets — not a strategic oracle. It is
withheld until the battle ends so a live human player cannot read the AI's bench
out of an in-progress response.

Data stays in `localStorage`. `setRemoteSink` accepts a `{name, submit}` sink so
a backend such as Supabase can be added later without touching battle logic.

## Refresh policy assets

From this directory, with the repository Python environment available:

```bash
npm run export:policies
```

The exporter locates the newest completed run whose `source_metadata.json`
declares `gen3-lut-v1.1` with the audited semantics revision and which holds all
three milestone checkpoints, then writes the assets, `policies/index.json` and
the regression fixtures. Weights are always read through
`gen3rl.export.lut.collect`; nothing is transcribed by hand. `gen3-lut-v1`
checkpoints are rejected by `validate_checkpoint_schema`, so they cannot be
exported. PyTorch is an offline export dependency only and is not used at web
runtime.

## Local development

Node 22.18 or newer is required.

```bash
cd web-playtest
npm install
npm run dev
```

Open the URL printed by Vite. Its local middleware serves the same stateless
battle implementation as the Vercel function.

Run verification and the production build with:

```bash
npm test
npm run build
```

## Vercel deployment

1. Import the repository into Vercel.
2. Set **Root Directory** to `web-playtest`.
3. Select Node.js 22.x (at least 22.18).
4. Leave the detected build command as `npm run build` and output directory as
   `dist`.
5. Deploy. No environment variables, Python runtime, database, or credentials
   are required.

For a CLI deployment from the app directory:

```bash
cd web-playtest
npx vercel        # preview
npx vercel --prod # production
```

## Team fixtures

Seven modular fixtures cover the requested behavioural shapes: `adv-balanced`,
`adv-bulky-offense`, `adv-offense`, `status-stall`, `setup-heavy`,
`setup-immunity` and `rom-npc`. Either side can use any fixture. This is a
behavioural test pool, not a final benchmark.

## Current limitations

- Learned move scores plus neutral switch logits are reproduced; no v2 switch
  policy or Bayesian opponent inference is added.
- Blindness is a research UI convention, not an anti-tamper boundary. The
  stateless API needs the policy ID in every request, so a tester inspecting
  browser storage or network traffic could discover it mid-battle.
- `answer_availability` is availability bookkeeping. It does not know about
  Substitute, items, abilities, speed tiers or damage rolls, so it cannot prove
  that a listed answer would actually have worked.
- A full battle log is roughly 320 KB (about 14 KB per AI decision), so the
  `localStorage` archive holds on the order of fifteen battles. A failed save is
  reported in the UI rather than swallowed; download battles as you go.
- Stateless replay cost grows with battle length, though it avoids persistent
  infrastructure and keeps simulator-hidden state off the client.
- `feature_damage_fraction`, `feature_can_ko` and `feature_stage_summary` are
  encoded as constants in v1.1 (0, 0 and `zero`), exactly as during training.
