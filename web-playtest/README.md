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

### Public battle state

The battle screen, the battle log and the research log show the public
modifiers that change what a good decision is:

- weather, whether it came from a move or an ability, and the end-of-turn
  upkeeps left (Gen 3 move weather lasts five turns; ability weather is
  permanent, recorded as `turns_remaining: null`);
- each active Pokémon's HP, major status, stat stages (−6…+6) and announced
  volatiles such as Substitute, confusion, Leech Seed and Taunt;
- Reflect/Light Screen/Safeguard/Mist with turns remaining, and Spikes layers;
- the opponent Pokémon revealed so far, with HP and status.

`src/research/publicBattleState.ts` rebuilds this from one player's own
protocol stream only, so it can hold nothing a Showdown client would not show
that player. Each AI decision records it as `public_state` from the AI's side
(`perspective: "p2"`), each human action from the human's side, and the response
carries the human's current view. Exact HP appears only for the viewer's own
side; the opponent is a percentage. Stat stages survive Baton Pass (with its Gen
3 passable volatiles) and reset on any other switch, Haze and faint.

`public_state` is display and research data, not a policy input: the encoder
and the `observation` block are unchanged. This matters for analysis because
v1.1 encodes `feature_stage_summary` as a constant, so the policy never sees
stat stages even though the log now does. Research logs with this field are
`research_log_version: 3` or later; version 4 adds `metadata.battle_complete`.

To help separate an AI mistake from a team gap, each decision also gets an
`answer_availability` block once the battle is over, classifying the turn as
`answer_used`, `active_answer_unused`, `bench_answer_unused` or
`no_answer_existed`. It is shallow bookkeeping over the AI's own side — legal
super-effective damage, phazing, self-KO, applicable disabling status, plus the
same test over switch-legal bench movesets — not a strategic oracle. It is
withheld until the battle ends so a live human player cannot read the AI's bench
out of an in-progress response.

Every finished battle is saved in `localStorage` first and then, unless the
tester opts out, uploaded for research (see [Remote collection](#remote-collection)).

## Remote collection

```
battle finishes → finalized ResearchLog → saved in localStorage
    → POST /api/playtest (same origin) → Vercel function → Supabase Postgres
        success: marked uploaded · failure: stays local, marked pending, retried later
```

The browser only ever calls its own `/api/playtest`. The Supabase secret key is
a server-side environment variable read by `api/playtest.mjs`; it is never in
browser code (a test scans `src/` and the build is checked for it).

### What is sent

Exactly one body per battle revision:

```json
{"submission_id": "<uuid>", "revision": 1, "log": { /* the finalized ResearchLog */ }}
```

`log` is the same object the app already exports (metadata with the hidden
policy ID and provenance, AI decisions with scores, features and `public_state`,
human actions, the public battle log, turn flags and end-of-battle feedback).
Upload bookkeeping is stripped first. Nothing else is sent: no name, email,
account, cookies (`credentials: 'omit'`), analytics or fingerprinting. The
collector stores the log plus searchable columns derived from it and the
deployment's own `VERCEL_GIT_COMMIT_SHA`; it never stores the IP address or any
request header. (Vercel's own infrastructure logs are outside this database.)

### Hidden-information boundary

`server/playtest.ts` validates the body as an allowlist of the existing
ResearchLog shape before anything is stored. Unknown keys are rejected rather
than stored, including on AI decisions, their observation (`turn, own_active,
target, weather, moves, available_switch_count`), the observation target, and
`public_state`. It also rejects named AI switch options (they must stay
"Switch option N"), exact opponent HP in `public_state`,
any `hidden_debug_state_included` other than `false`, unfinished
battles (`battle_complete !== true`), contaminated or unknown policy IDs,
provenance that disagrees with the claimed checkpoint, unknown flag categories
and strengths, flag comments over 500 characters, feedback comments over 2,000,
and bodies over 1.5 MB. Errors are fixed codes such as
`{"ok": false, "error": "invalid_submission"}`; submitted text and database
errors are never echoed. Comments are stored as plain JSON strings and rendered
only as React text.

### Idempotency and later feedback

A battle gets one `submission_id`, generated once and kept in its archive entry,
so every retry is the same submission. Flags and feedback can be added after the
battle ends; each such change bumps the local `revision` and re-queues the
upload. The database function `submit_playtest` applies it atomically:

| request | response |
| --- | --- |
| new `submission_id` | `201 {"ok": true, "submission_id": …, "duplicate": false}` |
| same `submission_id`, same or older revision | `200 {…, "duplicate": true}` (no change) |
| same `submission_id`, newer revision | `200 {…, "duplicate": false, "updated": true}` (log replaced) |
| `submission_id` reused for another battle | `409 {"ok": false, "error": "submission_conflict"}` |

### Retries, opt-out and old archives

- Pending uploads are retried when the app loads, when the browser comes back
  online, after every finished battle, and from **Retry uploads** in the lobby or
  result panel (which ignores backoff).
- Backoff is 30 s doubling to 1 h per battle. A pass makes at most 10 requests and
  stops at the first network/5xx/429 failure, so an unreachable collector costs
  one request per pass. A 4xx validation rejection is marked `failed` and is not
  retried; the local copy is always kept.
- Upload state lives on the archive entry as `remote_submission` (`pending`,
  `uploaded` or `failed`, with `attempts`, `uploaded_at`, `last_error`). It is
  stripped from JSON/JSONL exports, which keep the plain ResearchLog shape.
- Archives written before this feature load unchanged and are **never**
  uploaded automatically: their testers were not shown the notice.
- The lobby shows the disclosure and a **Submit playtest logs for research**
  checkbox (on by default). While it is off, no request is made at all; battles
  finished while it was off stay local-only even if it is turned back on.
- If the local save fails (storage full), the upload is still attempted as a
  backup, with the same submission ID reused for later revisions.

### Supabase setup

1. Create a Supabase project.
2. In **SQL Editor**, run
   [`supabase/migrations/20260927000000_playtest_submissions.sql`](supabase/migrations/20260927000000_playtest_submissions.sql)
   (or `supabase db push` with the Supabase CLI). It creates
   `playtest_submissions` and `submit_playtest()`, enables row-level security with
   no policies, revokes the table and function from `anon`/`authenticated`, and
   grants them to `service_role`. It is safe to re-run.
3. In **Project Settings → API**, copy the project URL and a **secret** key
   (`sb_secret_…`, or the legacy `service_role` key). Do not use the publishable/anon
   key; it has no access by design.

### Environment variables

| name | where | value |
| --- | --- | --- |
| `SUPABASE_URL` | Vercel (Production + Preview), `.env.local` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Production + Preview), `.env.local` | the secret key |

Never prefix them with `VITE_`. Without them the deployed endpoint answers
`503 collector_unavailable` and every battle simply stays pending locally.
`.env*` files are git-ignored; copy [`.env.example`](.env.example) to start.

### Local development with collection

```bash
cd web-playtest
cp .env.example .env.local   # optional: fill in to write to a real Supabase project
npm run dev
```

The dev server mounts `/api/playtest` with the same handler as Vercel. Without
credentials it logs `in-memory dev store` and keeps submissions in memory, so
the upload UI works offline.

### Verify a deployment

After a finished battle, the result panel should show **✓ Saved locally** and
**✓ Uploaded for research**. Then, in the Supabase SQL editor:

```sql
select submission_id, revision, battle_id, policy_id, result, flagged_turn_count,
       has_feedback, received_at, app_commit
from public.playtest_submissions order by received_at desc limit 10;
```

A misconfigured deployment shows **⚠ Upload pending**; `last_error` in the
archive entry says why (`collector_unavailable`, `storage_error`, …).

### Export collected data

With the same two variables in the environment (never in the web build):

```bash
cd web-playtest
node --env-file=.env.local scripts/export-playtests.mjs --out playtests.jsonl
# options: --format json   --envelope   --since 2026-09-27T00:00:00Z   --policy v1.1-100m
```

Each line is one stored ResearchLog, the same shape as the app's local
**Download all as JSONL**, so both feed the same analysis. `--envelope` wraps
each as `{"submission": {columns…}, "payload": log}`. Directly with `psql` and
the database connection string:

```bash
psql "$DATABASE_URL" -At -c "select payload::text from public.playtest_submissions order by received_at, id" > playtests.jsonl
```

(Use `-At`, not `\copy`, which escapes backslashes inside comments.)

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
5. Under **Settings → Environment Variables**, add `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview (see
   [Remote collection](#remote-collection)). The battle itself needs no
   variables, Python runtime or database; without these two the site still works
   and uploads stay pending in each browser.
6. Deploy, finish one battle, and check the result panel and the
   verification query above.

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
- The collector's rate limit (30 requests per minute per client) is in memory
  per serverless instance, so it is best-effort rather than global. Blindness
  also applies here: a tester can read their own upload in the network panel.
- Remote collection does not re-verify a log against the simulator. It enforces
  the ResearchLog shape and privacy invariants, but a hand-crafted log with
  plausible values would be accepted. Treat submissions as tester reports.
- JSONB normalizes key order and whitespace; exported payloads are the same
  values, not byte-identical text.
- Stateless replay cost grows with battle length, though it avoids persistent
  infrastructure and keeps simulator-hidden state off the client.
- `feature_damage_fraction`, `feature_can_ko` and `feature_stage_summary` are
  encoded as constants in v1.1 (0, 0 and `zero`), exactly as during training.
- The pinned `gen3customgame` format sets `debug: true`, so Showdown's shared
  protocol reports exact HP for both sides even though it announces HP
  Percentage Mod. Everything the UI shows (field state, cards, battle log) and
  `public_state` report the opponent as a percentage; only the raw `public_log`
  in the response and exported log keeps the simulator's exact values, which is
  left unchanged to avoid altering pinned simulator output.
