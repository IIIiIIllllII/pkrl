import {createRequire} from 'node:module'
import type {ActionDiagnostic, AIDecision, BattleApiInput, BattleRequest, BattleResponse, LegalAction, Player, PolicyAsset, PublicState} from '../src/types'
import {TEAM_FIXTURES, teamById} from '../src/data/teams'
import {encodeRequest, featureCategories} from '../src/policy/encoder'
import {FEATURE_INDEX, FEATURE_VALUES, SCHEMA_VERSION} from '../src/policy/schema'
import {policyScores, selectTop1, validatePolicy} from '../src/policy/inference'
let runtimeRequire: NodeRequire | null = null

function getRuntimeRequire(): NodeRequire {
  // Vercel emits api/battle.js as CommonJS, where import.meta.url is not a
  // reliable base. Root resolution at the generated entrypoint instead.
  runtimeRequire ||= createRequire(`${process.cwd()}/api/battle.js`)
  return runtimeRequire
}
let BattleStream: any
let getPlayerStreams: any
let Dex: any

function loadPinnedSimulator(): void {
  if (BattleStream && getPlayerStreams && Dex) return
  // Delay filesystem-backed CommonJS loading until the request boundary. This
  // keeps Vercel packaging errors catchable and preserves the exact vendored build.
  const runtime = getRuntimeRequire()
  ;({BattleStream, getPlayerStreams} = runtime('../vendor/pokemon-showdown/dist/sim/battle-stream'))
  ;({Dex} = runtime('../vendor/pokemon-showdown/dist/sim/dex'))
}

let POLICIES: Record<string, PolicyAsset> | null = null

function loadPolicies(): Record<string, PolicyAsset> {
  if (POLICIES) return POLICIES
  const runtime = getRuntimeRequire()
  POLICIES = {
    'v1-10m': runtime('../public/policies/v1-10m.json') as PolicyAsset,
    'v1-50m': runtime('../public/policies/v1-50m.json') as PolicyAsset,
    'v1-100m': runtime('../public/policies/v1-100m.json') as PolicyAsset,
  }
  return POLICIES
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
    const species = (fields[3] || '').split(',')[0]; const data = Dex.species.get(species)
    const level = Number((fields[3] || '').match(/L(\d+)/)?.[1] || 100)
    state.target = {species, hpBucket: hpBucket(fields[4] || '100/100'), status: '', types: data.types || [], estimatedSpeed: Math.floor((2 * data.baseStats.spe + 31) * level / 100) + 5}
  } else if (['-damage', '-heal'].includes(command) && fields[2]?.startsWith(opponent) && state.target) {
    state.target.hpBucket = hpBucket(fields[3] || '')
    const status = (fields[3] || '').split(' ')[1]; if (status) state.target.status = status
  } else if (command === '-status' && fields[2]?.startsWith(opponent) && state.target) state.target.status = fields[3] || ''
  else if (command === '-curestatus' && fields[2]?.startsWith(opponent) && state.target) state.target.status = ''
  else if (command === 'faint' && fields[2]?.startsWith(opponent) && state.target) state.target.hpBucket = 0
  else if (command === '-weather') state.weather = fields[2] || ''
  else if (command === 'turn') state.turn = Number(fields[2]) || state.turn
}

function safeRequest(raw: BattleRequest, visible: PublicState): BattleRequest {
  const result: BattleRequest = {
    rqid: raw.rqid, wait: Boolean(raw.wait), forceSwitch: raw.forceSwitch || null,
    active: raw.active?.map(active => ({...active, moves: (active.moves || []).map(move => {
      const data = Dex.moves.get(move.id || move.move)
      let effectivenessBucket = 3
      if (visible.target?.types?.length) {
        const immune = visible.target.types.every(type => !Dex.getImmunity(data.type, type))
        if (immune) effectivenessBucket = 0
        else {
          const exponent = visible.target.types.reduce((sum, type) => sum + Dex.getEffectiveness(data.type, type), 0)
          effectivenessBucket = exponent <= -2 ? 1 : exponent === -1 ? 2 : exponent === 0 ? 3 : exponent === 1 ? 4 : 5
        }
      }
      return {...move, id: data.id, type: data.type, basePower: data.basePower, accuracy: data.accuracy,
        priority: data.priority, status: data.status, boosts: data.boosts, self: data.self, effectivenessBucket}
    })})) || null,
    side: raw.side ? {id: raw.side.id, name: raw.side.name, pokemon: raw.side.pokemon.map(mon => ({
      ident: mon.ident, details: mon.details, condition: mon.condition, active: Boolean(mon.active), stats: mon.stats,
      moves: mon.moves || [], types: Dex.species.get(String(mon.details || '').split(',')[0]).types,
    }))} : undefined,
    public: structuredClone(visible),
  }
  return result
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

async function nextView(stream: any, player: Player, publicState: PublicState): Promise<PlayerView> {
  const chunks: string[] = []
  for (let reads = 0; reads < 20; reads++) {
    const chunk = await stream.read()
    if (chunk == null) return {request: null, chunks, terminal: true, winner: null}
    chunks.push(chunk)
    let request: BattleRequest | null = null; let terminal = false; let winner: string | null = null
    for (const line of chunk.split('\n')) {
      updatePublic(player, publicState, line)
      if (line.startsWith('|request|')) request = JSON.parse(line.slice('|request|'.length))
      else if (line.startsWith('|win|')) { terminal = true; winner = line.slice(5) }
      else if (line === '|tie') terminal = true
    }
    if (terminal || request) return {request, chunks, terminal, winner}
  }
  throw new Error('simulator did not produce a request')
}

function diagnostics(asset: PolicyAsset, request: BattleRequest): {decision: AIDecision; choice: string} {
  const {features, mask} = encodeRequest(request); const scores = policyScores(asset, features, mask); const chosen = selectTop1(scores)
  const actions = legalActions(request, false); const byIndex = new Map(actions.map(action => [action.index, action]))
  const candidates: ActionDiagnostic[] = Array.from({length: 9}, (_, index) => {
    const action = byIndex.get(index); const row = index < 4 ? features[index] : null; const categories = row ? featureCategories(row) : null
    return {index, label: action?.label || (index < 4 ? `Move slot ${index + 1}` : `Switch option ${index - 3}`), kind: index < 4 ? 'move' : 'switch',
      legal: mask[index], score: scores[index], feature_ids: row, feature_categories: categories,
      move_role: categories?.move_role || null, effectiveness: categories?.effectiveness || null}
  })
  const legalScores = scores.filter((score): score is number => score != null).sort((a, b) => b - a)
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
  return {choice: selected.choice, decision: {turn: request.public?.turn || 0, observation, legal_action_mask: mask, candidates,
    chosen_action: candidates[chosen], top1_score: legalScores[0], top2_score: legalScores[1] ?? null,
    margin: legalScores[1] == null ? null : legalScores[0] - legalScores[1], resulting_visible_events: []}}
}

function validateInput(input: BattleApiInput): void {
  if (!/^[-a-zA-Z0-9]{1,80}$/.test(input.battle_id)) throw new Error('invalid battle ID')
  if (!Array.isArray(input.seed) || input.seed.length !== 4 || input.seed.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) throw new Error('seed must contain four uint16 values')
  if (!loadPolicies()[input.policy_id]) throw new Error('unknown policy ID')
  if (!teamById(input.human_team_id) || !teamById(input.ai_team_id)) throw new Error('unknown team fixture')
  if (!Array.isArray(input.human_choices) || input.human_choices.length > 500 || input.human_choices.some(choice => !/^(move|switch) [1-6]$/.test(choice))) throw new Error('invalid choice history')
}

export async function replayBattle(input: BattleApiInput, testTeams?: {human: Array<Record<string, unknown>>; ai: Array<Record<string, unknown>>}): Promise<BattleResponse> {
  loadPinnedSimulator()
  validateInput(input); const asset = loadPolicies()[input.policy_id]; validatePolicy(asset)
  const humanTeam = teamById(input.human_team_id)!; const aiTeam = teamById(input.ai_team_id)!
  const battle = new BattleStream({keepAlive: true}); const streams = getPlayerStreams(battle)
  const publicState = {p1: initialPublic(), p2: initialPublic()}; const allHumanChunks: string[] = []; const aiDecisions: AIDecision[] = []
  let consumed = 0
  try {
    battle.write(`>start ${JSON.stringify({formatid: 'gen3customgame', seed: input.seed})}\n>player p1 ${JSON.stringify({name: 'Human', team: testTeams?.human || humanTeam.team})}\n>player p2 ${JSON.stringify({name: 'V1 LUT', team: testTeams?.ai || aiTeam.team})}`)
    let [human, ai] = await Promise.all([nextView(streams.p1, 'p1', publicState.p1), nextView(streams.p2, 'p2', publicState.p2)])
    allHumanChunks.push(...human.chunks)
    for (let cycle = 0; cycle < 1000; cycle++) {
      if (human.terminal || ai.terminal) {
        if (consumed !== input.human_choices.length) throw new Error('choice history continues after battle end')
        return response(input, null, [], allHumanChunks, aiDecisions, true, human.winner || ai.winner, publicState.p1.turn)
      }
      const humanLegal = human.request ? legalActions(human.request, true) : []
      const needsHuman = Boolean(human.request && !human.request.wait && humanLegal.length)
      if (needsHuman && consumed >= input.human_choices.length) {
        return response(input, safeRequest(human.request!, publicState.p1), humanLegal, allHumanChunks, aiDecisions, false, null, publicState.p1.turn)
      }
      const writes: string[] = []
      if (needsHuman) {
        const choice = input.human_choices[consumed++]; if (!humanLegal.some(action => action.choice === choice)) throw new Error(`illegal human action at choice ${consumed}: ${choice}`)
        writes.push(`>p1 ${choice}`)
      }
      if (ai.request && !ai.request.wait) {
        const safe = safeRequest(ai.request, publicState.p2); const result = diagnostics(asset, safe)
        aiDecisions.push(result.decision); writes.push(`>p2 ${result.choice}`)
      }
      if (!writes.length) throw new Error('battle reached a state with no actionable request')
      battle.write(writes.join('\n'))
      const previousLineCount = publicLines(allHumanChunks).length
      ;[human, ai] = await Promise.all([nextView(streams.p1, 'p1', publicState.p1), nextView(streams.p2, 'p2', publicState.p2)])
      allHumanChunks.push(...human.chunks)
      if (aiDecisions.length) aiDecisions.at(-1)!.resulting_visible_events = publicLines(allHumanChunks).slice(previousLineCount)
    }
    throw new Error('battle exceeded safety cycle limit')
  } finally { battle.destroy() }
}

function response(input: BattleApiInput, request: BattleRequest | null, legal: LegalAction[], chunks: string[], decisions: AIDecision[], terminal: boolean, winner: string | null, turn: number): BattleResponse {
  return {battle_id: input.battle_id, seed: input.seed, simulator: SIMULATOR_ID, feature_schema: SCHEMA_VERSION, policy_id: input.policy_id,
    request, legal_actions: legal, public_log: publicLines(chunks), turn, ai_decisions: decisions, terminal, winner}
}

export {TEAM_FIXTURES}
