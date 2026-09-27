import {createRequire} from 'node:module'
import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {gunzipSync} from 'node:zlib'
import type {
  ActionDiagnostic, AIDecision, AnswerAvailability, BattleApiInput, BattleRequest, BattleResponse,
  HumanAction, LegalAction, MoveRequest, Player, PolicyAsset, PublicBattleState, PublicState,
} from '../src/types'
import {PublicBattleTracker} from '../src/research/publicBattleState'
import {TEAM_FIXTURES, teamById} from '../src/data/teams'
import {encodeRequest, featureCategories} from '../src/policy/encoder'
import {FEATURE_VALUES, SCHEMA_VERSION} from '../src/policy/schema'
import {policyProvenance, POLICY_IDS, QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {
  activatedFeatureIds, assertCleanCheckpointPolicy, policyScores, quantizedScores,
  rankScores, scoreContributions, selectTop1,
} from '../src/policy/inference'
import {classifyMove, resolveMoveSemantics} from '../src/policy/moveSemantics'
import policy20m from '../public/policies/v1.1-20m.json'
import policy50m from '../public/policies/v1.1-50m.json'
import policy100m from '../public/policies/v1.1-100m.json'
import {PINNED_RUNTIME_GZIP_BASE64, PINNED_RUNTIME_ID} from './generated-runtime'

export const AI_PLAYER_NAME = 'AI'
export const HUMAN_PLAYER_NAME = 'Human'

let runtimeRequire: NodeRequire | null = null

function getRuntimeRequire(): NodeRequire {
  if (runtimeRequire) return runtimeRequire
  const root = join(tmpdir(), `pkrl-showdown-${PINNED_RUNTIME_ID}`)
  const marker = join(root, '.complete')
  if (!existsSync(marker)) {
    const archive = JSON.parse(gunzipSync(Buffer.from(PINNED_RUNTIME_GZIP_BASE64, 'base64')).toString()) as Record<string, string>
    for (const [relativePath, contents] of Object.entries(archive)) {
      if (relativePath.startsWith('/') || relativePath.split('/').includes('..')) throw new Error('invalid embedded simulator path')
      const destination = join(root, relativePath)
      mkdirSync(dirname(destination), {recursive: true})
      writeFileSync(destination, Buffer.from(contents, 'base64'))
    }
    writeFileSync(marker, PINNED_RUNTIME_ID)
  }
  runtimeRequire = createRequire(join(root, 'entry.cjs'))
  return runtimeRequire
}
let BattleStream: any
let getPlayerStreams: any
let Dex: any
let Gen3Dex: any

function loadPinnedSimulator(): void {
  if (BattleStream && getPlayerStreams && Dex) return
  // Delay filesystem-backed CommonJS loading until the request boundary. This
  // keeps Vercel packaging errors catchable and preserves the exact vendored build.
  const runtime = getRuntimeRequire()
  ;({BattleStream, getPlayerStreams} = runtime('./dist/sim/battle-stream'))
  ;({Dex} = runtime('./dist/sim/dex'))
  Gen3Dex = Dex.mod('gen3')
}

/**
 * Only frozen clean gen3-lut-v1.1 checkpoints are loadable. Contaminated
 * gen3-lut-v1 assets live in `web-playtest/quarantine/` and are never imported,
 * so no code path can score with old weights.
 */
let policies: Record<string, PolicyAsset> | null = null
function loadPolicies(): Record<string, PolicyAsset> {
  if (policies) return policies
  const registry: Record<string, PolicyAsset> = {
    'v1.1-20m': policy20m as unknown as PolicyAsset,
    'v1.1-50m': policy50m as unknown as PolicyAsset,
    'v1.1-100m': policy100m as unknown as PolicyAsset,
  }
  for (const [id, asset] of Object.entries(registry)) {
    assertCleanCheckpointPolicy(asset)
    if (asset.policy_id !== id) throw new Error(`policy asset ${id} declares policy_id ${asset.policy_id}`)
  }
  if (Object.keys(registry).sort().join(',') !== [...POLICY_IDS].sort().join(',')) {
    throw new Error('the server policy registry disagrees with the permitted playtest checkpoints')
  }
  policies = registry
  return registry
}

export const SIMULATOR_ID = 'pokemon-showdown@2ddfa0476f8207e12e204b1c69f7c7683b17633c/gen3customgame'

interface PlayerView {request: BattleRequest | null; chunks: string[]; terminal: boolean; winner: string | null}

function initialPublic(): PublicState { return {target: null, weather: '', turn: 0} }

function hpBucket(condition: string): number {
  if (condition.includes('fnt')) return 0
  const match = condition.match(/(\d+)\/(\d+)/)
  if (!match) return 4
  const hp = Number(match[1]); const max = Number(match[2])
  return hp <= 0 ? 0 : hp * 4 <= max ? 1 : hp * 2 <= max ? 2 : hp * 4 <= max * 3 ? 3 : 4
}

function updatePublic(player: Player, state: PublicState, line: string): void {
  const fields = line.split('|'); const command = fields[1] || ''; const opponent = player === 'p1' ? 'p2' : 'p1'
  if (['switch', 'drag', 'replace'].includes(command) && fields[2]?.startsWith(opponent)) {
    const species = (fields[3] || '').split(',')[0]; const data = Gen3Dex.species.get(species)
    const level = Number((fields[3] || '').match(/L(\d+)/)?.[1] || 100)
    state.target = {species, hpBucket: hpBucket(fields[4] || '100/100'), status: (fields[4] || '').split(' ')[1] || '', types: data.types || [], estimatedSpeed: Math.floor((2 * data.baseStats.spe + 31) * level / 100) + 5}
  } else if (['-damage', '-heal'].includes(command) && fields[2]?.startsWith(opponent) && state.target) {
    state.target.hpBucket = hpBucket(fields[3] || '')
    const status = (fields[3] || '').split(' ')[1]; if (status) state.target.status = status
  } else if (command === '-status' && fields[2]?.startsWith(opponent) && state.target) state.target.status = fields[3] || ''
  else if (command === '-curestatus' && fields[2]?.startsWith(opponent) && state.target) state.target.status = ''
  else if (command === 'faint' && fields[2]?.startsWith(opponent) && state.target) state.target.hpBucket = 0
  else if (command === '-weather') state.weather = fields[2] || ''
  else if (command === 'turn') state.turn = Number(fields[2]) || state.turn
}

/** Enrich one move request entry with pinned static Gen 3 data plus v1.1 semantics. */
function enrichMove(move: MoveRequest, visible: PublicState): MoveRequest {
  // Move requests collapse typed Hidden Power to id `hiddenpower`, while
  // the display name retains its real type and Gen 3 base power.
  const hiddenPower = /^Hidden Power ([A-Za-z]+)(?: (\d+))?$/.exec(move.move || '')
  const data = Gen3Dex.moves.get(hiddenPower ? move.move : move.id || move.move)
  const moveType = hiddenPower?.[1] || data.type
  const basePower = hiddenPower?.[2] ? Number(hiddenPower[2]) : data.basePower
  const enriched = {...move, id: data.id, type: moveType, basePower, accuracy: data.accuracy,
    priority: data.priority, status: data.status, target: data.target, boosts: data.boosts, self: data.self,
    fixedDamage: data.damage ?? (data.damageCallback ? 'callback' : undefined),
    isDamageMove: data.category !== 'Status'}
  return {...enriched, ...resolveMoveSemantics(enriched, visible.target?.types || [], visible.target?.status || '')}
}

function safeRequest(raw: BattleRequest, visible: PublicState): BattleRequest {
  return {
    rqid: raw.rqid, wait: Boolean(raw.wait), forceSwitch: raw.forceSwitch || null,
    active: raw.active?.map(active => ({...active, moves: (active.moves || []).map(move => enrichMove(move, visible))})) || null,
    side: raw.side ? {id: raw.side.id, name: raw.side.name, pokemon: raw.side.pokemon.map(mon => ({
      ident: mon.ident, details: mon.details, condition: mon.condition, active: Boolean(mon.active), stats: mon.stats,
      moves: (mon.moves || []).map((move: string) => Gen3Dex.moves.get(move).name || move),
      item: mon.item ? Gen3Dex.items.get(mon.item).name || mon.item : '',
      types: Gen3Dex.species.get(String(mon.details || '').split(',')[0]).types,
    }))} : undefined,
    public: structuredClone(visible),
  }
}

export function legalActions(request: BattleRequest, revealSwitches = true): LegalAction[] {
  if (!request || request.wait) return []
  const result: LegalAction[] = []; const mons = request.side?.pokemon || []
  const switches = mons.map((mon, index) => ({mon, slot: index + 1})).filter(({mon}) => !mon.active && !mon.condition.includes('fnt'))
  if (request.forceSwitch?.[0]) {
    switches.slice(0, 5).forEach(({mon, slot}, index) => result.push({index: 4 + index, choice: `switch ${slot}`, label: revealSwitches ? `Switch to ${String(mon.details || mon.ident || `slot ${slot}`).split(',')[0].replace(/^p\d: /, '')}` : `Switch option ${index + 1}`, kind: 'switch'}))
    return result
  }
  request.active?.[0]?.moves.forEach((move, index) => {
    if (!move.disabled && (move.pp == null || move.pp > 0)) result.push({index, choice: `move ${index + 1}`, label: move.move, kind: 'move'})
  })
  if (!request.active?.[0]?.trapped && !request.active?.[0]?.maybeTrapped) {
    switches.slice(0, 5).forEach(({mon, slot}, index) => result.push({index: 4 + index, choice: `switch ${slot}`, label: revealSwitches ? `Switch to ${String(mon.details || mon.ident || `slot ${slot}`).split(',')[0].replace(/^p\d: /, '')}` : `Switch option ${index + 1}`, kind: 'switch'}))
  }
  return result
}

function publicLines(chunks: string[]): string[] {
  const ignored = new Set(['request', 't:', 'upkeep', 'split'])
  return chunks.flatMap(chunk => chunk.split('\n')).filter(line => line.startsWith('|') && !ignored.has(line.split('|')[1]))
}

async function nextView(stream: any, player: Player, publicState: PublicState, tracker: PublicBattleTracker): Promise<PlayerView> {
  const chunks: string[] = []
  for (let reads = 0; reads < 20; reads++) {
    const chunk = await stream.read()
    if (chunk == null) return {request: null, chunks, terminal: true, winner: null}
    chunks.push(chunk)
    let request: BattleRequest | null = null; let terminal = false; let winner: string | null = null
    for (const line of chunk.split('\n')) {
      updatePublic(player, publicState, line)
      tracker.apply(line)
      if (line.startsWith('|request|')) request = JSON.parse(line.slice('|request|'.length))
      else if (line.startsWith('|win|')) { terminal = true; winner = line.slice(5) }
      else if (line === '|tie') terminal = true
    }
    if (terminal || request) return {request, chunks, terminal, winner}
  }
  throw new Error('simulator did not produce a request')
}

const DISABLING_STATUS = new Set(['par', 'slp', 'frz'])

/**
 * Did the AI actually have a response to the current opposing Pokémon?
 *
 * This is deliberately shallow bookkeeping, not a strategic oracle: an "answer"
 * is a legal super-effective damaging move, a phazing move, a self-KO move, or
 * an applicable paralysis/sleep/freeze status move — plus the same test applied
 * to the movesets of switch-legal bench members. It exists so a successful human
 * setup sweep can be attributed to a team gap rather than automatically to the
 * policy. It reads only the AI's own side and is withheld until the battle ends.
 */
function answerAvailability(request: BattleRequest, mask: boolean[], chosenIndex: number, targetTypes: string[]): AnswerAvailability {
  const active: AnswerAvailability['active_answers'] = []
  const moves = request.active?.[0]?.moves || []
  moves.slice(0, 4).forEach((move, index) => {
    if (!mask[index]) return
    const semantics = resolveMoveSemantics(move, targetTypes, request.public?.target?.status || '')
    const effectiveness = FEATURE_VALUES.effectiveness[semantics.effectivenessBucket]
    const id = String(move.id || move.move || '').toLowerCase().replaceAll(' ', '')
    let reason = ''
    if (semantics.moveClass !== 'status' && semantics.effectivenessBucket >= 4) reason = 'super-effective damage'
    else if (['roar', 'whirlwind'].includes(id)) reason = 'phazing removes boosts'
    else if (['explosion', 'selfdestruct'].includes(id)) reason = 'self-KO trade'
    else if (semantics.moveClass === 'status' && semantics.applicable && DISABLING_STATUS.has(String(move.status || '').toLowerCase())) reason = 'disabling status'
    if (reason) active.push({index, label: move.move, reason, effectiveness})
  })
  const bench: AnswerAvailability['bench_answers'] = []
  const mons = request.side?.pokemon || []
  const switchable = mons.map((mon, slot) => ({mon, slot})).filter(({mon}) => !mon.active && !mon.condition.includes('fnt'))
  switchable.slice(0, 5).forEach(({mon}, offset) => {
    const index = 4 + offset
    if (!mask[index]) return
    const species = String(mon.details || mon.ident || '').split(',')[0].replace(/^p\d: /, '')
    let best = ''; let bestEffectiveness = ''
    for (const name of mon.moves || []) {
      const data = Gen3Dex.moves.get(name)
      if (!data?.exists) continue
      const candidate: MoveRequest = {move: data.name, id: data.id, type: data.type, basePower: data.basePower,
        status: data.status, target: data.target, isDamageMove: data.category !== 'Status',
        fixedDamage: data.damage ?? (data.damageCallback ? 'callback' : undefined)}
      const semantics = resolveMoveSemantics(candidate, targetTypes, request.public?.target?.status || '')
      if (classifyMove(candidate) !== 'status' && semantics.effectivenessBucket >= 4) {
        best = 'bench super-effective damage'; bestEffectiveness = FEATURE_VALUES.effectiveness[semantics.effectivenessBucket]
        break
      }
      if (['roar', 'whirlwind'].includes(data.id) && !best) { best = 'bench phazing removes boosts'; bestEffectiveness = 'neutral' }
    }
    if (best) bench.push({index, species, reason: best, effectiveness: bestEffectiveness})
  })
  const chosenWasAnswer = active.some(entry => entry.index === chosenIndex) || bench.some(entry => entry.index === chosenIndex)
  const classification: AnswerAvailability['classification'] = chosenWasAnswer ? 'answer_used'
    : active.length ? 'active_answer_unused'
    : bench.length ? 'bench_answer_unused'
    : 'no_answer_existed'
  return {classification, active_answers: active, bench_answers: bench, chosen_was_answer: chosenWasAnswer}
}

function diagnostics(asset: PolicyAsset, request: BattleRequest, battleId: string, publicBattleState: PublicBattleState): {decision: AIDecision; choice: string} {
  const {features, mask} = encodeRequest(request)
  const scores = policyScores(asset, features, mask)
  const integers = quantizedScores(asset, features, mask)
  const ranking = rankScores(scores)
  const chosen = selectTop1(scores)
  const actions = legalActions(request, false); const byIndex = new Map(actions.map(action => [action.index, action]))
  const moves = request.active?.[0]?.moves || []
  // Every candidate carries its activated global LUT indices, so a per-term
  // breakdown is reconstructible offline from `policy_id` for any action. Only
  // the chosen action inlines the weights, which keeps a full battle small
  // enough for the browser's local archive.
  const candidates: ActionDiagnostic[] = Array.from({length: 9}, (_, index) => {
    const action = byIndex.get(index); const row = index < 4 ? features[index] : null
    const categories = row ? featureCategories(row) : null
    const move = index < 4 ? moves[index] : undefined
    return {index, label: action?.label || (index < 4 ? `Move slot ${index + 1}` : `Switch option ${index - 3}`), kind: index < 4 ? 'move' : 'switch',
      legal: mask[index], score: scores[index], quantized_score: integers[index],
      feature_ids: row, feature_categories: categories,
      activated_feature_ids: row ? activatedFeatureIds(row, index) : null,
      contributions: row && index === chosen ? scoreContributions(asset, row, index) : null,
      move_role: categories?.move_role || null,
      move_class: move?.moveClass ?? null, applicable: move?.applicable ?? null,
      effectiveness: categories?.effectiveness || null}
  })
  const selected = byIndex.get(chosen)
  if (!selected) throw new Error(`policy selected illegal action ${chosen}`)
  const own = request.side?.pokemon.find(mon => mon.active)
  const observation = {
    turn: request.public?.turn || 0,
    own_active: own ? {condition: own.condition, types: own.types, speed: own.stats?.spe} : null,
    target: request.public?.target || null,
    weather: request.public?.weather || '',
    moves: request.active?.[0]?.moves.map(move => ({id: move.id, move: move.move, pp: move.pp, disabled: Boolean(move.disabled)})) || [],
    available_switch_count: mask.slice(4).filter(Boolean).length,
  }
  const integerLegal = integers.filter((value): value is number => value != null)
  let integerBest = -1
  integers.forEach((value, index) => { if (value != null && (integerBest < 0 || value > (integers[integerBest] as number))) integerBest = index })
  return {choice: selected.choice, decision: {
    battle_id: battleId, policy_id: asset.policy_id, turn: request.public?.turn || 0, observation,
    public_state: publicBattleState,
    legal_actions: actions, legal_action_mask: mask, candidates, chosen_action: candidates[chosen],
    resolved_defender_types: request.public?.target?.types || [],
    top1_score: ranking.top1_score, top2_score: ranking.top2_score, top2_index: ranking.top2_index,
    margin: ranking.margin,
    quantized_top1_score: integerLegal.length ? Math.max(...integerLegal) : null,
    quantized_selected_action: integerBest < 0 ? null : integerBest,
    resulting_visible_events: [],
  }}
}

function validateInput(input: BattleApiInput): void {
  if (!/^[-a-zA-Z0-9]{1,80}$/.test(input.battle_id)) throw new Error('invalid battle ID')
  if (!Array.isArray(input.seed) || input.seed.length !== 4 || input.seed.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) throw new Error('seed must contain four uint16 values')
  if ((QUARANTINED_POLICY_IDS as readonly string[]).includes(input.policy_id)) {
    throw new Error(`policy ${input.policy_id} belongs to the contaminated gen3-lut-v1 generation and is quarantined`)
  }
  if (!loadPolicies()[input.policy_id]) throw new Error('unknown policy ID')
  if (!teamById(input.human_team_id) || !teamById(input.ai_team_id)) throw new Error('unknown team fixture')
  if (!Array.isArray(input.human_choices) || input.human_choices.length > 500 || input.human_choices.some(choice => !/^(move|switch) [1-6]$/.test(choice))) throw new Error('invalid choice history')
}

export async function replayBattle(input: BattleApiInput, testTeams?: {human: Array<Record<string, unknown>>; ai: Array<Record<string, unknown>>}): Promise<BattleResponse> {
  loadPinnedSimulator()
  validateInput(input); const asset = loadPolicies()[input.policy_id]
  assertCleanCheckpointPolicy(asset)
  const humanTeam = teamById(input.human_team_id)!; const aiTeam = teamById(input.ai_team_id)!
  const battle = new BattleStream({keepAlive: true}); const streams = getPlayerStreams(battle)
  const publicState = {p1: initialPublic(), p2: initialPublic()}
  // Display/research only: each tracker sees exactly its own player's stream.
  const trackers = {p1: new PublicBattleTracker('p1'), p2: new PublicBattleTracker('p2')}
  const allHumanChunks: string[] = []; const aiDecisions: AIDecision[] = []; const humanActions: HumanAction[] = []
  const aiRequests: BattleRequest[] = []
  let consumed = 0
  try {
    battle.write(`>start ${JSON.stringify({formatid: 'gen3customgame', seed: input.seed})}\n>player p1 ${JSON.stringify({name: HUMAN_PLAYER_NAME, team: testTeams?.human || humanTeam.team})}\n>player p2 ${JSON.stringify({name: AI_PLAYER_NAME, team: testTeams?.ai || aiTeam.team})}`)
    let [human, ai] = await Promise.all([nextView(streams.p1, 'p1', publicState.p1, trackers.p1), nextView(streams.p2, 'p2', publicState.p2, trackers.p2)])
    allHumanChunks.push(...human.chunks)
    for (let cycle = 0; cycle < 1000; cycle++) {
      if (human.terminal || ai.terminal) {
        if (consumed !== input.human_choices.length) throw new Error('choice history continues after battle end')
        attachAnswerAvailability(aiDecisions, aiRequests)
        return response(input, asset, null, [], allHumanChunks, trackers.p1.snapshot(), aiDecisions, humanActions, true, human.winner || ai.winner, publicState.p1.turn)
      }
      const humanLegal = human.request ? legalActions(human.request, true) : []
      const needsHuman = Boolean(human.request && !human.request.wait && humanLegal.length)
      if (needsHuman && consumed >= input.human_choices.length) {
        return response(input, asset, safeRequest(human.request!, publicState.p1), humanLegal, allHumanChunks, trackers.p1.snapshot(), aiDecisions, humanActions, false, null, publicState.p1.turn)
      }
      const writes: string[] = []
      if (needsHuman) {
        const choice = input.human_choices[consumed++]
        const action = humanLegal.find(candidate => candidate.choice === choice)
        if (!action) throw new Error(`illegal human action at choice ${consumed}: ${choice}`)
        humanActions.push({turn: publicState.p1.turn, choice, label: action.label, kind: action.kind, public_state: trackers.p1.snapshot()})
        writes.push(`>p1 ${choice}`)
      }
      if (ai.request && !ai.request.wait) {
        const safe = safeRequest(ai.request, publicState.p2); const result = diagnostics(asset, safe, input.battle_id, trackers.p2.snapshot())
        aiDecisions.push(result.decision); aiRequests.push(safe); writes.push(`>p2 ${result.choice}`)
      }
      if (!writes.length) throw new Error('battle reached a state with no actionable request')
      battle.write(writes.join('\n'))
      const previousLineCount = publicLines(allHumanChunks).length
      ;[human, ai] = await Promise.all([nextView(streams.p1, 'p1', publicState.p1, trackers.p1), nextView(streams.p2, 'p2', publicState.p2, trackers.p2)])
      allHumanChunks.push(...human.chunks)
      if (aiDecisions.length) aiDecisions.at(-1)!.resulting_visible_events = publicLines(allHumanChunks).slice(previousLineCount)
    }
    throw new Error('battle exceeded safety cycle limit')
  } finally { battle.destroy() }
}

/**
 * Post-hoc analysis metadata, added only once the battle is over so that a live
 * human player can never read the AI's bench out of an in-progress response.
 */
function attachAnswerAvailability(decisions: AIDecision[], requests: BattleRequest[]): void {
  decisions.forEach((decision, index) => {
    const request = requests[index]
    if (!request) return
    decision.answer_availability = answerAvailability(request, decision.legal_action_mask,
      decision.chosen_action.index, request.public?.target?.types || [])
  })
}

function response(input: BattleApiInput, asset: PolicyAsset, request: BattleRequest | null, legal: LegalAction[], chunks: string[], publicBattleState: PublicBattleState, decisions: AIDecision[], humanActions: HumanAction[], terminal: boolean, winner: string | null, turn: number): BattleResponse {
  return {battle_id: input.battle_id, seed: input.seed, simulator: SIMULATOR_ID, feature_schema: SCHEMA_VERSION,
    policy_id: input.policy_id, policy_provenance: policyProvenance(asset),
    request, legal_actions: legal, public_log: publicLines(chunks), public_state: publicBattleState, turn,
    ai_decisions: decisions, human_actions: humanActions, terminal, winner}
}

export {TEAM_FIXTURES}
