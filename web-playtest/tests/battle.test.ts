import {describe, expect, it} from 'vitest'
import {AI_PLAYER_NAME, replayBattle} from '../server/simulator'
import battleHandler from '../api/battle.mjs'
import type {BattleApiInput, BattleResponse} from '../src/types'
import {POLICY_IDS, QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {SCHEMA_VERSION} from '../src/policy/schema'

const base: BattleApiInput = {battle_id: 'test-battle', seed: [44, 45, 46, 47], policy_id: 'v1.1-100m', human_team_id: 'rom-npc', ai_team_id: 'rom-npc', human_choices: []}

async function post(input: BattleApiInput): Promise<{status: number; body: any}> {
  const response = await battleHandler.fetch(new Request('https://playtest.example/api/battle', {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(input),
  }))
  return {status: response.status, body: await response.json()}
}

/** Drive a battle to completion (or the safety limit) with a fixed human choice. */
async function playOut(input: BattleApiInput, teams: {human: any[]; ai: any[]}, maxTurns = 40): Promise<BattleResponse> {
  const choices: string[] = []
  let result = await replayBattle({...input, human_choices: choices}, teams)
  for (let turn = 0; turn < maxTurns && !result.terminal; turn++) {
    if (!result.legal_actions.length) break
    choices.push(result.legal_actions[0].choice)
    result = await replayBattle({...input, human_choices: [...choices]}, teams)
  }
  return result
}

describe('stateless pinned simulator', () => {
  it('only accepts clean v1.1 policies', async () => {
    for (const id of QUARANTINED_POLICY_IDS) {
      await expect(replayBattle({...base, policy_id: id})).rejects.toThrow(/contaminated gen3-lut-v1 generation and is quarantined/)
      const {status, body} = await post({...base, policy_id: id})
      expect(status).toBe(400); expect(body.error).toMatch(/quarantined/)
    }
    await expect(replayBattle({...base, policy_id: 'v1.1-parity-synthetic'})).rejects.toThrow(/unknown policy ID/)
    for (const id of POLICY_IDS) {
      const result = await replayBattle({...base, policy_id: id})
      expect(result.policy_id).toBe(id)
      expect(result.feature_schema).toBe(SCHEMA_VERSION)
      expect(result.policy_provenance).toMatchObject({policy_id: id, generation: 'clean-v1.1', parameter_count: 349})
    }
  })

  it('cannot condition its first decision on the future human choice or hidden team', async () => {
    const ai = [{species: 'Swampert', level: 50, moves: ['Surf', 'Earthquake', 'Protect']}]
    const input = {...base, battle_id: 'counterfactual'}
    const results = []
    for (const [choice, item, ability, bench] of [
      ['move 1', 'Leftovers', 'Run Away', 'Mewtwo'],
      ['move 2', 'Choice Band', 'Guts', 'Mew'],
    ]) {
      const human = [{species: 'Rattata', level: 50, moves: ['Protect', 'Tackle'], item, ability},
        {species: bench, level: 50, moves: ['Psychic']}]
      const result = await replayBattle({...input, human_choices: [choice]}, {human, ai})
      const decision = result.ai_decisions[0]
      expect(decision).toBeDefined()
      results.push({observation: decision.observation, candidates: decision.candidates, chosen: decision.chosen_action})
    }
    expect(results[0]).toEqual(results[1])
  })

  it('serves JSON through the Vercel Web handler', async () => {
    const {status, body} = await post(base)
    expect(status).toBe(200)
    expect(body).toMatchObject({battle_id: 'test-battle', feature_schema: SCHEMA_VERSION, terminal: false})
  })

  it('rejects a non-POST request', async () => {
    const response = await battleHandler.fetch(new Request('https://playtest.example/api/battle', {method: 'GET'}))
    expect(response.status).toBe(405)
  })

  it('the deployed server bundle matches current v1.1 TypeScript inference', async () => {
    const input = {...base, human_choices: ['move 1']}
    const {status, body} = await post(input)
    expect(status).toBe(200)
    expect(body).toEqual(await replayBattle(input))
  })

  it('is deterministic and never returns an illegal AI action', async () => {
    const first = await replayBattle(base); const second = await replayBattle(base)
    expect(first).toEqual(second); expect(first.terminal).toBe(false); expect(first.legal_actions.length).toBeGreaterThan(0)
    const advancedInput = {...base, human_choices: [first.legal_actions[0].choice]}
    const advanced = await replayBattle(advancedInput); const repeated = await replayBattle(advancedInput)
    expect(advanced).toEqual(repeated); expect(advanced.ai_decisions.length).toBeGreaterThan(0)
    for (const decision of advanced.ai_decisions) {
      expect(decision.legal_action_mask[decision.chosen_action.index]).toBe(true)
      expect(decision.chosen_action.legal).toBe(true)
      expect(decision.legal_actions.some(action => action.index === decision.chosen_action.index)).toBe(true)
    }
  })

  it('rejects an illegal human choice history', async () => {
    await expect(replayBattle({...base, human_choices: ['move 9' as string]})).rejects.toThrow(/invalid choice history/)
    await expect(replayBattle({...base, human_choices: ['switch 1']})).rejects.toThrow(/illegal human action/)
  })

  it('completes an end-to-end battle and reveals the checkpoint', async () => {
    const oneMove = [{species: 'Electrode', level: 100, moves: ['Explosion']}]
    const start = await replayBattle({...base, battle_id: 'completion'}, {human: oneMove, ai: oneMove})
    expect(start.legal_actions).toHaveLength(1)
    const end = await replayBattle({...base, battle_id: 'completion', human_choices: [start.legal_actions[0].choice]}, {human: oneMove, ai: oneMove})
    expect(end.terminal).toBe(true); expect(end.ai_decisions).toHaveLength(1)
    expect(end.ai_decisions[0].legal_action_mask[end.ai_decisions[0].chosen_action.index]).toBe(true)
    expect(end.human_actions).toHaveLength(1)
    expect(end.human_actions[0]).toMatchObject({choice: 'move 1', kind: 'move'})
    expect(end.policy_provenance.policy_id).toBe('v1.1-100m')
  })

  it('plays a full human-vs-AI battle to a winner', async () => {
    const human = [{species: 'Swampert', level: 100, ability: 'Torrent', moves: ['Surf', 'Earthquake']},
      {species: 'Blissey', level: 100, ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled']}]
    const ai = [{species: 'Pidgey', level: 5, ability: 'Keen Eye', moves: ['Tackle']},
      {species: 'Rattata', level: 5, ability: 'Run Away', moves: ['Tackle']}]
    const result = await playOut({...base, battle_id: 'full-battle'}, {human, ai})
    expect(result.terminal).toBe(true)
    expect(result.winner).toBe('Human')
    expect(result.ai_decisions.length).toBeGreaterThan(1)
    expect(result.public_log.some(line => line.startsWith('|win|'))).toBe(true)
    for (const decision of result.ai_decisions) expect(decision.legal_action_mask[decision.chosen_action.index]).toBe(true)
  })

  it('treats any type immunity as 0x for dual-type targets', async () => {
    const human = [{species: 'Skarmory', level: 50, moves: ['Protect']}]
    const ai = [{species: 'Swampert', level: 50, moves: ['Earthquake', 'Surf']}]
    const input = {...base, battle_id: 'dual-type-immunity'}
    const start = await replayBattle(input, {human, ai})
    const result = await replayBattle({...input, human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const earthquake = result.ai_decisions[0].candidates.find(action => action.label === 'Earthquake')
    const surf = result.ai_decisions[0].candidates.find(action => action.label === 'Surf')
    expect(earthquake?.feature_categories?.effectiveness).toBe('immune')
    expect(earthquake?.applicable).toBe(false)
    expect(surf?.feature_categories?.effectiveness).toBe('neutral')
    expect(result.ai_decisions[0].resolved_defender_types).toEqual(['Steel', 'Flying'])
  })

  /**
   * The reported human-playtest failure: Gyarados spamming Earthquake into
   * Skarmory. Type logic is untouched; this asserts the live battle behaviour and
   * reports the immune move's LUT contributions if a checkpoint regresses.
   */
  it.each([...POLICY_IDS])('%s never uses Earthquake against Skarmory', async id => {
    const human = [{species: 'Skarmory', level: 50, ability: 'Keen Eye', moves: ['Protect', 'Drill Peck']}]
    const ai = [{species: 'Gyarados', level: 50, ability: 'Intimidate', moves: ['Earthquake', 'Double-Edge', 'Dragon Dance']}]
    const result = await playOut({...base, battle_id: 'gyarados-skarmory', policy_id: id}, {human, ai}, 12)
    expect(result.ai_decisions.length).toBeGreaterThan(2)
    for (const decision of result.ai_decisions) {
      const earthquake = decision.candidates.find(action => action.label === 'Earthquake')
      expect(earthquake?.feature_categories?.effectiveness).toBe('immune')
      const contributions = JSON.stringify((earthquake?.contributions || [])
        .filter(term => Math.abs(term.weight) > 0.05).map(term => [term.term, term.category, Number(term.weight.toFixed(4))]))
      expect(decision.chosen_action.label, `${id} turn ${decision.turn} chose an immune move; contributions: ${contributions}`).not.toBe('Earthquake')
    }
  })

  it('uses the actual Hidden Power type and Gen 3 power from the request', async () => {
    const human = [{species: 'Swampert', level: 50, moves: ['Protect']}]
    const ai = [{species: 'Jolteon', level: 50, moves: ['Hidden Power Grass', 'Thunderbolt']}]
    const input = {...base, battle_id: 'hidden-power-type'}
    const start = await replayBattle(input, {human, ai})
    const result = await replayBattle({...input, human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const hiddenPower = result.ai_decisions[0].candidates.find(action => action.label.startsWith('Hidden Power Grass'))
    expect(hiddenPower?.feature_categories).toMatchObject({move_type: 'grass', damage_class: 'special', power_bucket: '41_70', effectiveness: 'quadruple'})
  })
})

describe('hidden information isolation', () => {
  it('does not serialize an unrevealed opponent party member, item or ability', async () => {
    const human = [{species: 'Swampert', level: 50, item: 'Leftovers', moves: ['Surf']}]
    const ai = [{species: 'Pidgey', level: 50, ability: 'Keen Eye', item: 'Choice Band', moves: ['Tackle']}, {species: 'Mewtwo', level: 50, ability: 'Pressure', item: 'Lum Berry', moves: ['Psychic']}]
    const result = await replayBattle({...base, battle_id: 'privacy'}, {human, ai}); const serialized = JSON.stringify(result).toLowerCase()
    expect(result.request?.side?.pokemon[0]).toMatchObject({item: 'Leftovers', moves: ['Surf']})
    expect(serialized).toContain('pidgey'); expect(serialized).not.toContain('mewtwo'); expect(serialized).not.toContain('pressure')
    expect(serialized).not.toContain('choice band'); expect(serialized).not.toContain('lum berry')
    expect(result.ai_decisions.every(decision => !('developer_hidden_state' in decision))).toBe(true)
  })

  it('exposes only public target facts to the AI observation', async () => {
    const human = [{species: 'Swampert', level: 50, item: 'Leftovers', moves: ['Surf', 'Earthquake']},
      {species: 'Gengar', level: 50, moves: ['Thunderbolt']}]
    const ai = [{species: 'Skarmory', level: 50, moves: ['Drill Peck', 'Spikes']}]
    const start = await replayBattle({...base, battle_id: 'observation'}, {human, ai})
    const result = await replayBattle({...base, battle_id: 'observation', human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const observation = result.ai_decisions[0].observation as any
    expect(Object.keys(observation).sort()).toEqual(['available_switch_count', 'moves', 'own_active', 'target', 'turn', 'weather'])
    expect(Object.keys(observation.target).sort()).toEqual(['estimatedSpeed', 'hpBucket', 'species', 'status', 'types'])
    // Public HP is bucketed, never exact, and the human's second move is unseen.
    expect(observation.target.hpBucket).toBeLessThanOrEqual(4)
    expect(JSON.stringify(observation)).not.toContain('Earthquake')
  })

  it('anonymizes AI switch options while a battle is in progress', async () => {
    const human = [{species: 'Swampert', level: 50, moves: ['Surf']}]
    const ai = [{species: 'Pidgey', level: 50, moves: ['Tackle']}, {species: 'Snorlax', level: 50, moves: ['Body Slam']}]
    const start = await replayBattle({...base, battle_id: 'anonymous-switch'}, {human, ai})
    const result = await replayBattle({...base, battle_id: 'anonymous-switch', human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const switches = result.ai_decisions[0].candidates.filter(action => action.kind === 'switch' && action.legal)
    expect(switches.length).toBeGreaterThan(0)
    for (const action of switches) expect(action.label).toMatch(/^Switch option \d$/)
    expect(JSON.stringify(result)).not.toContain('Snorlax')
  })

  it('withholds answer-availability analysis until the battle is over', async () => {
    const oneMove = [{species: 'Electrode', level: 100, moves: ['Explosion']}]
    const teams = {human: oneMove, ai: oneMove}
    const start = await replayBattle({...base, battle_id: 'analysis-gate'}, teams)
    expect(start.ai_decisions.every(decision => decision.answer_availability === undefined)).toBe(true)
    const end = await replayBattle({...base, battle_id: 'analysis-gate', human_choices: [start.legal_actions[0].choice]}, teams)
    expect(end.terminal).toBe(true)
    expect(end.ai_decisions.length).toBeGreaterThan(0)
    for (const decision of end.ai_decisions) {
      expect(decision.answer_availability).toBeDefined()
      expect(['answer_used', 'active_answer_unused', 'bench_answer_unused', 'no_answer_existed'])
        .toContain(decision.answer_availability!.classification)
    }
  })

  it('distinguishes a missing team answer from an unused one', async () => {
    const human = [{species: 'Gyarados', level: 55, ability: 'Intimidate', moves: ['Dragon Dance', 'Double-Edge']}]
    // No super-effective answer, no phazing, no disabling status anywhere.
    const helpless = [{species: 'Sunflora', level: 50, ability: 'Chlorophyll', moves: ['Razor Leaf']},
      {species: 'Ledian', level: 50, ability: 'Swarm', moves: ['Comet Punch']}]
    // Jolteon's Thunderbolt is 2x on Water/Flying, and Skarmory can phaze.
    const answered = [{species: 'Sunflora', level: 50, ability: 'Chlorophyll', moves: ['Razor Leaf']},
      {species: 'Jolteon', level: 50, ability: 'Volt Absorb', moves: ['Thunderbolt']}]
    const gap = await playOut({...base, battle_id: 'team-gap'}, {human, ai: helpless}, 20)
    const present = await playOut({...base, battle_id: 'team-answer'}, {human, ai: answered}, 20)
    const gapKinds = new Set(gap.ai_decisions.map(decision => decision.answer_availability?.classification))
    const presentKinds = new Set(present.ai_decisions.map(decision => decision.answer_availability?.classification))
    expect(gapKinds).toEqual(new Set(['no_answer_existed']))
    expect([...presentKinds].some(kind => kind === 'bench_answer_unused' || kind === 'answer_used')).toBe(true)
  })
})

describe('research logging fields', () => {
  it('records every field v2 design needs for each AI decision', async () => {
    const human = [{species: 'Swampert', level: 50, moves: ['Surf', 'Protect']}]
    const ai = [{species: 'Salamence', level: 50, moves: ['Dragon Claw', 'Earthquake', 'Fire Blast', 'Dragon Dance']},
      {species: 'Snorlax', level: 50, moves: ['Body Slam']}]
    const start = await replayBattle({...base, battle_id: 'log-fields'}, {human, ai})
    const result = await replayBattle({...base, battle_id: 'log-fields', human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const decision = result.ai_decisions[0]
    expect(Object.keys(decision).sort()).toEqual([
      'battle_id', 'candidates', 'chosen_action', 'legal_action_mask', 'legal_actions', 'margin',
      'observation', 'policy_id', 'public_state', 'quantized_selected_action', 'quantized_top1_score',
      'resolved_defender_types', 'resulting_visible_events', 'top1_score', 'top2_index', 'top2_score', 'turn',
    ])
    expect(decision.battle_id).toBe('log-fields')
    expect(decision.policy_id).toBe('v1.1-100m')
    expect(decision.legal_action_mask).toHaveLength(9)
    expect(decision.candidates).toHaveLength(9)
    expect(decision.margin).toBeGreaterThanOrEqual(0)
    expect(decision.top1_score).toBeGreaterThanOrEqual(decision.top2_score!)
    expect(decision.resulting_visible_events.length).toBeGreaterThan(0)
    const chosen = decision.chosen_action
    expect(chosen.activated_feature_ids).toHaveLength(26)
    expect(chosen.contributions).toHaveLength(26)
    expect(chosen.contributions!.map(term => term.global_id)).toEqual(chosen.activated_feature_ids)
    // Non-chosen actions keep their activated indices, so their per-term
    // breakdown stays reconstructible from `policy_id` without bloating the log.
    for (const candidate of decision.candidates) {
      if (candidate.index === chosen.index) continue
      expect(candidate.contributions).toBeNull()
      if (candidate.index < 4) expect(candidate.activated_feature_ids).toHaveLength(26)
    }
    expect(chosen.move_role).toBeTruthy()
    expect(chosen.move_class).toBeTruthy()
    expect(chosen.effectiveness).toBeTruthy()
    expect(chosen.quantized_score).not.toBeNull()
    for (const candidate of decision.candidates.slice(0, 4)) {
      expect(candidate.feature_ids).toHaveLength(20)
      expect(candidate.activated_feature_ids!.every(value => value >= 0 && value < 349)).toBe(true)
    }
  })

  it('records the public weather, stat stages and screens behind each decision', async () => {
    const human = [{species: 'Ninjask', level: 100, ability: 'Speed Boost', moves: ['Swords Dance', 'Reflect', 'Sunny Day']}]
    const ai = [{species: 'Blissey', level: 50, ability: 'Natural Cure', moves: ['Seismic Toss']},
      {species: 'Mewtwo', level: 50, ability: 'Pressure', moves: ['Psychic']}]
    const input = {...base, battle_id: 'public-state', human_choices: ['move 1', 'move 2', 'move 3']}
    const result = await replayBattle(input, {human, ai})
    expect(result.terminal).toBe(false)
    // Human view at the start of turn 4.
    expect(result.public_state.turn).toBe(4)
    expect(result.public_state.weather).toEqual({name: 'SunnyDay', source: 'move', started_turn: 3, turns_remaining: 4})
    expect(result.public_state.self.active).toMatchObject({species: 'Ninjask', boosts: {atk: 2, spe: 3}})
    expect(result.public_state.self.active?.hp?.[1]).toBeGreaterThan(0)
    expect(result.public_state.self.conditions).toEqual([{name: 'Reflect', layers: null, started_turn: 2, turns_remaining: 3}])
    expect(result.public_state.opponent.active).toMatchObject({species: 'Blissey', status: '', boosts: {}})
    expect(result.public_state.opponent.active).not.toHaveProperty('hp')
    // The AI's turn-3 decision saw the human's setup from its own side of the field.
    const turn3 = result.ai_decisions.find(decision => decision.turn === 3)!
    expect(turn3.public_state.perspective).toBe('p2')
    expect(turn3.public_state.opponent.active).toMatchObject({species: 'Ninjask', boosts: {atk: 2, spe: 2}})
    expect(turn3.public_state.opponent.active).not.toHaveProperty('hp')
    expect(turn3.public_state.opponent.conditions).toEqual([{name: 'Reflect', layers: null, started_turn: 2, turns_remaining: 4}])
    expect(turn3.public_state.weather).toBeNull()
    expect(result.human_actions[2].public_state.self.active?.boosts).toEqual({atk: 2, spe: 2})
    // Unrevealed bench members never enter any public state.
    expect(JSON.stringify([result.public_state, result.ai_decisions.map(decision => decision.public_state)])).not.toContain('Mewtwo')
    // The policy input is unchanged: the observation carries no public_state.
    expect(turn3.observation).not.toHaveProperty('public_state')
  })

  it('serializes the whole battle log without loss', async () => {
    const oneMove = [{species: 'Electrode', level: 100, moves: ['Explosion']}]
    const start = await replayBattle({...base, battle_id: 'serialize'}, {human: oneMove, ai: oneMove})
    const end = await replayBattle({...base, battle_id: 'serialize', human_choices: [start.legal_actions[0].choice]}, {human: oneMove, ai: oneMove})
    expect(JSON.parse(JSON.stringify(end))).toEqual(end)
    expect(end.public_log.every(line => line.startsWith('|'))).toBe(true)
    expect(end.winner === null || typeof end.winner === 'string').toBe(true)
  })

  it('names the AI player without leaking the checkpoint', async () => {
    expect(AI_PLAYER_NAME).toBe('AI')
    const result = await replayBattle({...base, battle_id: 'player-name'})
    expect(result.public_log.join('\n')).not.toMatch(/v1\.1-\d+m/)
  })
})
