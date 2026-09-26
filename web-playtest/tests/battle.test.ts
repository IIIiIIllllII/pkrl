import {describe, expect, it} from 'vitest'
import {replayBattle} from '../server/simulator'
import battleHandler from '../api/battle.mjs'
import type {BattleApiInput} from '../src/types'

const base: BattleApiInput = {battle_id: 'test-battle', seed: [44, 45, 46, 47], policy_id: 'v1-100m', human_team_id: 'rom-npc', ai_team_id: 'rom-npc', human_choices: []}

describe('stateless pinned simulator', () => {
  it('v1.1 cannot condition its first decision on the future human choice or hidden team', async () => {
    const ai = [{species: 'Swampert', level: 50, moves: ['Surf', 'Earthquake', 'Protect']}]
    const input = {...base, battle_id: 'counterfactual', policy_id: 'v1.1-parity-synthetic'}
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
    const request = new Request('https://playtest.example/api/battle', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(base)})
    const response = await battleHandler.fetch(request); const body = await response.json()
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/json')
    expect(body).toMatchObject({battle_id: 'test-battle', feature_schema: 'gen3-lut-v1', terminal: false})
  })

  it('is deterministic and never returns an illegal AI action', async () => {
    const first = await replayBattle(base); const second = await replayBattle(base)
    expect(first).toEqual(second); expect(first.terminal).toBe(false); expect(first.legal_actions.length).toBeGreaterThan(0)
    const advancedInput = {...base, human_choices: [first.legal_actions[0].choice]}
    const advanced = await replayBattle(advancedInput); const repeated = await replayBattle(advancedInput)
    expect(advanced).toEqual(repeated); expect(advanced.ai_decisions.length).toBeGreaterThan(0)
    for (const decision of advanced.ai_decisions) expect(decision.legal_action_mask[decision.chosen_action.index]).toBe(true)
  })

  it('completes an end-to-end battle', async () => {
    const oneMove = [{species: 'Electrode', level: 100, moves: ['Explosion']}]
    const start = await replayBattle({...base, battle_id: 'completion'}, {human: oneMove, ai: oneMove})
    expect(start.legal_actions).toHaveLength(1)
    const end = await replayBattle({...base, battle_id: 'completion', human_choices: [start.legal_actions[0].choice]}, {human: oneMove, ai: oneMove})
    expect(end.terminal).toBe(true); expect(end.ai_decisions).toHaveLength(1)
    expect(end.ai_decisions[0].legal_action_mask[end.ai_decisions[0].chosen_action.index]).toBe(true)
  })

  it('treats any type immunity as 0x for dual-type targets', async () => {
    const human = [{species: 'Skarmory', level: 50, moves: ['Protect']}]
    const ai = [{species: 'Swampert', level: 50, moves: ['Earthquake', 'Surf']}]
    const input = {...base, battle_id: 'dual-type-immunity', policy_id: 'v1.1-parity-synthetic'}
    const start = await replayBattle(input, {human, ai})
    const result = await replayBattle({...input, human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const earthquake = result.ai_decisions[0].candidates.find(action => action.label === 'Earthquake')
    const surf = result.ai_decisions[0].candidates.find(action => action.label === 'Surf')
    expect(earthquake?.feature_categories?.effectiveness).toBe('immune')
    expect(surf?.feature_categories?.effectiveness).toBe('neutral')
  })

  it('uses the actual Hidden Power type and Gen 3 power from the request', async () => {
    const human = [{species: 'Swampert', level: 50, moves: ['Protect']}]
    const ai = [{species: 'Jolteon', level: 50, moves: ['Hidden Power Grass', 'Thunderbolt']}]
    const input = {...base, battle_id: 'hidden-power-type', policy_id: 'v1.1-parity-synthetic'}
    const start = await replayBattle(input, {human, ai})
    const result = await replayBattle({...input, human_choices: [start.legal_actions[0].choice]}, {human, ai})
    const hiddenPower = result.ai_decisions[0].candidates.find(action => action.label.startsWith('Hidden Power Grass'))
    expect(hiddenPower?.feature_categories).toMatchObject({move_type: 'grass', damage_class: 'special', power_bucket: '41_70', effectiveness: 'quadruple'})
  })

  it('does not serialize an unrevealed opponent party member or hidden ability', async () => {
    const human = [{species: 'Swampert', level: 50, item: 'Leftovers', moves: ['Surf']}]
    const ai = [{species: 'Pidgey', level: 50, ability: 'Keen Eye', item: 'Choice Band', moves: ['Tackle']}, {species: 'Mewtwo', level: 50, ability: 'Pressure', item: 'Lum Berry', moves: ['Psychic']}]
    const result = await replayBattle({...base, battle_id: 'privacy'}, {human, ai}); const serialized = JSON.stringify(result).toLowerCase()
    expect(result.request?.side?.pokemon[0]).toMatchObject({item: 'Leftovers', moves: ['Surf']})
    expect(serialized).toContain('pidgey'); expect(serialized).not.toContain('mewtwo'); expect(serialized).not.toContain('pressure')
    expect(serialized).not.toContain('choice band'); expect(serialized).not.toContain('lum berry')
    expect(result.ai_decisions.every(decision => !('developer_hidden_state' in decision))).toBe(true)
  })
})
