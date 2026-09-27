# Quarantined contaminated `gen3-lut-v1` web assets

These files are the **contaminated** historical baseline described in
[`docs/contamination_audit.md`](../../../docs/contamination_audit.md). They were
trained with:

- generic type-effectiveness features incorrectly applied to status/self moves;
- a dual-type immunity bug in one implementation path.

They are kept **only** so automated tests can prove they are rejected. They are
deliberately outside `web-playtest/public/`, so Vite never serves them, and
nothing in `src/` or `server/` imports them.

| file | schema | status |
| --- | --- | --- |
| `v1-10m.json` | `gen3-lut-v1` | rejected — contaminated |
| `v1-50m.json` | `gen3-lut-v1` | rejected — contaminated |
| `v1-100m.json` | `gen3-lut-v1` | rejected — contaminated |
| `parity-fixtures.json` | `gen3-lut-v1` | historical v1 parity oracle |

Do not move these back into `public/`, do not add them to
`server/simulator.ts`, and do not reference them from `src/policy/assets.ts`.
Human playtesting must only ever load clean `gen3-lut-v1.1` policies.
