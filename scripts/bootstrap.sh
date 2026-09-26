#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v uv >/dev/null || { echo 'Install uv 0.12.9, then rerun bootstrap.' >&2; exit 1; }
[[ "$(uv --version)" == 'uv 0.12.9'* ]] || { echo 'Use uv 0.12.9' >&2; exit 1; }
test "$(node --version)" = "v$(<.node-version)" || { echo "Use Node $(<.node-version)" >&2; exit 1; }
uv sync --locked --python "$(<.python-version)" --extra train --extra test
.venv/bin/python -m gen3rl.cli bootstrap
.venv/bin/python -m gen3rl.cli extract-trainers
if command -v npm >/dev/null && [[ "$(npm --version)" == '11.6.0' ]]; then
  npm ci --prefix web-playtest
else
  npm_cli=third_party/npm/bin/npm-cli.js
  if [[ ! -f "$npm_cli" ]]; then npm_cli=third_party/npm/package/bin/npm-cli.js; fi
  node "$npm_cli" ci --prefix web-playtest
fi
(
  cd web-playtest
  node scripts/embed-simulator.mjs
  ./node_modules/.bin/esbuild server/simulator.ts --bundle --platform=node --format=cjs --target=node22 --outfile=server-dist/simulator.cjs
  node node_modules/typescript/bin/tsc -b
  node node_modules/vite/bin/vite.js build
)
.venv/bin/python -m gen3rl.cli doctor
