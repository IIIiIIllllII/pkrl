# Known training runs

| Directory | Schema | Decisions | Label | Use |
|---|---:|---:|---|---|
| `20260919-173958/` | `gen3-lut-v1` | 100,000,182 | `gen3-lut-v1-buggy / contaminated-type-effectiveness` | Historical before/after baseline only; never resume or export as v1.1 |
| `new run 1.1/runs/gen3-lut-v1.1/20260926-160543-1c6977/` | `gen3-lut-v1.1` | 100,000,137 | `clean-v1.1` | The clean run. Source of the `v1.1-20m` / `v1.1-50m` / `v1.1-100m` web playtest assets |

New v1.1 runs are written beneath `artifacts/runs/gen3-lut-v1.1/`, keeping the
historical run and root v1 exports separate.

Checkpoint directories are gitignored. The clean run's small provenance files
(`summary.json`, `source_metadata.json`, `lut_manifest.json`,
`lut_quantized.json`, milestone evaluations and the generated ROM LUT) are
tracked under
`artifacts/gen3-lut-v1.1/clean-run-20260926-160543-1c6977/`, and each exported
web asset records its source checkpoint's SHA-256 so provenance survives
without the 136 MB of `.pt` files.
