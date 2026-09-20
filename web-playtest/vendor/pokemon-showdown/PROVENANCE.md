# Simulator provenance

The JavaScript runtime files in this directory were copied from the repository's
`third_party/pokemon-showdown/dist` build at commit:

`2ddfa0476f8207e12e204b1c69f7c7683b17633c`

Only the runtime files needed by `gen3customgame` are included: simulator and
library JavaScript, base data, the Gen 3–8 inheritance chain, and the formats
configuration. Source maps, text translations, random-team generators, server
code, and unrelated mods are omitted. The upstream MIT license is included.

Do not replace these files with the same-numbered npm release: its runtime data
and simulator files are not byte-identical to the training checkout.

The unmodified `ts-chacha20` 1.2.0 runtime dependency is colocated under
`node_modules/` so Node can resolve the pinned simulator's PRNG dependency in a
standalone Vercel function bundle.
