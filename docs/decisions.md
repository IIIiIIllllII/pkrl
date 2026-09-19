# Decisions

- Upstreams: Pokémon Showdown `2ddfa0476f8207e12e204b1c69f7c7683b17633c` and
  pokeemerald `5eff78649e7170a877b961ef0b3da13b81a16038`.
- Primary format is `gen3customgame`; `gen3ou` is benchmark-only.
- IPC observations are derived only from each side's `|request|` JSON. No
  `Battle` object is serialized.
- Gen 3 physical/special class is determined by type. Normal through Steel in
  the cartridge type order are physical; Fire through Dark are special.
- HP buckets use integer cross multiplication, never percentages or floats.
- The initial schema is intentionally compact. Unknown opponent facts use a
  conservative neutral/default value until a player-visible protocol tracker is
  added; they are never filled from omniscient state.
- ROM v1 is restricted to normal trainer singles. Vanilla switching, items,
  doubles, Safari, roamer, first battle, facilities, recorded/link, and other
  special paths remain untouched.

