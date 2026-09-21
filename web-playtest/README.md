# Human vs. V1 LUT playtest

This app runs human-vs-policy Gen 3 battles for qualitative v1 evaluation. It
supports blind 10M/50M/100M checkpoint selection, legal moves and switches,
turn flags, a short end survey, debug scores/features, local persistence, and
single-battle or session JSON exports.

The bundled 10M/50M/100M policies are explicitly preserved contaminated
`gen3-lut-v1` baselines. They run through an isolated legacy encoder for
reproducibility. The default TypeScript encoder and v1.1 parity fixtures use
the corrected `gen3-lut-v1.1` semantics; clean playtest assets require a new
v1.1 training run.

## Architecture and parity

The browser owns the React UI, local research archive, and downloads. A
stateless `/api/battle` function deterministically replays the submitted human
choice history and selects v1 actions. No battle database or persistent server
state is required.

Pokémon Showdown cannot be safely bundled into a browser unchanged: its Dex
loads formats and generation data through Node's filesystem and dynamic
`require`. The serverless function therefore uses the exact compiled runtime
from training commit `2ddfa0476f8207e12e204b1c69f7c7683b17633c`, vendored under
`vendor/pokemon-showdown`. The same-numbered npm release was checked and is not
byte-identical, so it is deliberately not used for mechanics.

AI observations are rebuilt only from the AI player's `|request|` and public
battle protocol. The response and exported research log omit unrevealed party
members, items, abilities, and simulator internals. Debug mode shows policy
features and scores, not omniscient battle state.

The float32 LUT path matches training inference and keeps v1's neutral zero
switch logits. Thus v1 may select a switch when every learned move score is
below zero; this reproduces the training/evaluation policy and is not v2
switching logic.

## Refresh policy assets

From this directory, with the repository Python environment available:

```bash
npm run export:policies
```

The exporter automatically locates the newest completed run containing a 100M
checkpoint and writes the three available milestone assets plus Python parity
fixtures. PyTorch is only an offline export dependency and is not used at web
runtime.

The exporter rejects v1 checkpoints while the active schema is v1.1. Point it
at a completed clean v1.1 run; it will not relabel old weights.

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
npx vercel
npx vercel --prod
```

## Current limitations

- V1 learned move scores plus neutral switch logits are reproduced; no v2
  switch policy or Bayesian inference is added.
- The initial fixture library is intentionally small (five teams).
- Blindness is a research UI convention, not an anti-tamper boundary; a tester
  inspecting browser storage/network traffic could discover the policy ID.
- Stateless replay cost grows with battle length, though it avoids persistent
  infrastructure and keeps simulator-hidden state off the client.
