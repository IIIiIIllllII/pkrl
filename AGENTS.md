# AGENTS.md
AI coding agents: read `AGENTS.md` before modifying this repository.
## Project

Pokemon RL is a Pokémon battle AI project targeting strong but fair
(non-cheating) trainer AI for ROM hacks.

The current production policy generation is:

- schema: `gen3-lut-v1.1`
- additive LUT policy
- 349 parameters
- masked PPO
- Pokémon Showdown Gen 3
- format: `gen3customgame`
- ROM-friendly int8 LUT export

## Current status

`gen3-lut-v1.1` is the current clean baseline.

The older `gen3-lut-v1` 100M run is CONTAMINATED and must not be used as
the final reference policy.

Historical v1 bugs included:

1. generic type-effectiveness features applied to status/self moves
2. incorrect dual-type immunity handling in one implementation path

Do not reintroduce these semantics.

## Canonical implementation

Python is the canonical reference implementation.

TypeScript/web and C implementations must match Python.

When changing:
- feature encoding
- move classification
- type effectiveness
- action masking
- LUT scoring

always update/add parity tests.

Do not independently invent equivalent logic in multiple languages.

## Simulator

Pinned Pokémon Showdown commit:

`2ddfa0476f8207e12e204b1c69f7c7683b17633c`

Do not silently upgrade simulator mechanics.

## Feature semantics

Ordinary damaging moves:
- use Gen 3 type effectiveness
- dual types multiply
- any immunity factor => final 0x

Status/self/field moves:
- must NOT receive generic damage-chart effectiveness features
- use mechanics-specific applicability rules instead

Examples:
- Dragon Dance: no opponent type-effectiveness feature
- Swords Dance: no opponent type-effectiveness feature
- Recover: no opponent type-effectiveness feature
- Protect: no opponent type-effectiveness feature
- Growl vs Ghost: do not apply Normal/Ghost damage immunity
- Confuse Ray vs Normal: do not apply Ghost/Normal damage immunity

Mechanics-specific status immunity:
- Thunder Wave -> Ground fails in Gen 3
- Toxic -> Steel fails
- Toxic -> Poison fails
- Will-O-Wisp -> Fire fails
- Leech Seed -> Grass fails

Fixed damage:
- Seismic Toss -> Ghost immune
- Night Shade -> Normal immune
- do not apply ordinary super-effective/resisted damage scaling

Required regression cases:
- Earthquake -> Skarmory = 0x
- Thunderbolt -> Swampert = 0x
- Ice Beam -> Salamence = 4x
- Fire -> Scizor = 4x
- Fighting -> Gengar = 0x
- Psychic -> Tyranitar = 0x
- Poison -> Metagross = 0x

## Fairness / hidden information

The AI must not cheat.

Do not expose:
- unrevealed opponent moves
- unrevealed bench Pokémon
- hidden items
- hidden abilities unless legitimately revealed
- future player actions
- raw hidden simulator state

Use request/public observation only.

## Training

Current proven settings:

- rollout_size: 4096
- PPO epochs: 4
- minibatch: 1024
- synchronous frozen-policy rollout generations
- CPU learner
- multi-process rollout workers

Do not reduce PPO work merely to improve benchmark numbers.

Real PPO training throughput matters.
Rollout-only throughput is not a valid long-run performance benchmark.

PyTorch/BLAS thread oversubscription has previously caused a severe slowdown.
Training runtime should use low thread counts as configured by the project.

Before a long run:
1. clean git tree
2. full tests pass
3. Python/TS parity pass
4. Python/C parity pass
5. privacy/hidden-info tests pass
6. real PPO benchmark pass
7. illegal actions = 0
8. no NaN/Inf
9. `scripts/preflight.sh` reports READY FOR LONG RUN

Do not start long training automatically unless explicitly requested.

## Reproducibility

Use pinned project versions.

Expected environment currently includes:
- Python from `.python-version`
- Node from `.node-version`
- uv version documented by project
- dependencies from lockfiles
- pinned Showdown commit

Important fixes must be committed.
Do not leave performance or correctness fixes only on temporary cloud machines.

## Web playtest

The web playtest is for human evaluation of clean v1.1.

Primary checkpoint candidates:
- 20M
- 50M
- 100M

Normal playtest should support blind checkpoint selection.

The web UI must show legitimate public battle state needed for human judgment:
- HP
- status
- weather
- visible stat stages
- screens
- hazards
- other public battle-state modifiers where relevant

Do not display hidden information.

Research logs should record:
- battle ID
- turn
- policy checkpoint
- public state
- legal actions
- LUT score for each legal action
- chosen action
- top1/top2 margin
- activated features
- visible result
- human "AI decision looked wrong" flags

## Current roadmap

v1.1:
- clean move-policy baseline
- human playtesting
- failure analysis

v2 (NOT YET IMPLEMENTED):
- unified move + switch RL
- Bayesian belief tracker for hidden information
- human-inspired heuristic features

Do not implement v2 unless explicitly requested.

## Human-playtest philosophy

Do not assume every lost battle is an AI failure.

Distinguish:
- no answer existed in the team
- active Pokémon had an answer but did not use it
- bench switch answer existed but was not used
- policy genuinely made a poor decision

The project's ultimate goal is:
strong trainer decision-making without cheating.
