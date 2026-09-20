import {describe, expect, it} from 'vitest'
import {replayBattle} from '../server/simulator'
import battleHandler from '../api/battle'
import type {BattleApiInput} from '../src/types'

const base: BattleApiInput = {battle_id: 'test-battle', seed: [44, 45, 46, 47], policy_id: 'v1-100m', human_team_id: 'rom-npc', ai_team_id: 'rom-npc', human_choices: []}

describe('stateless pinned simulator', () => {
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

  it('does not serialize an unrevealed opponent party member or hidden ability', async () => {
    const human = [{species: 'Swampert', level: 50, moves: ['Surf']}]
    const ai = [{species: 'Pidgey', level: 50, ability: 'Keen Eye', moves: ['Tackle']}, {species: 'Mewtwo', level: 50, ability: 'Pressure', moves: ['Psychic']}]
    const result = await replayBattle({...base, battle_id: 'privacy'}, {human, ai}); const serialized = JSON.stringify(result).toLowerCase()
    expect(serialized).toContain('pidgey'); expect(serialized).not.toContain('mewtwo'); expect(serialized).not.toContain('pressure')
    expect(result.ai_decisions.every(decision => !('developer_hidden_state' in decision))).toBe(true)
  })
})
