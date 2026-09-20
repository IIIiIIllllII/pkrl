import {describe, expect, it} from 'vitest'
import {createResearchLog, flagTurn, finalizeLog} from '../src/research/logging'
import type {BattleResponse} from '../src/types'

const response: BattleResponse = {battle_id: 'b-1', seed: [1,2,3,4], simulator: 'pinned', feature_schema: 'gen3-lut-v1', policy_id: 'v1-50m', request: null,
  legal_actions: [], public_log: [], turn: 12, ai_decisions: [], terminal: true, winner: 'Human'}

describe('research logging', () => {
  it('flags a turn and serializes feedback without hidden debug state', () => {
    let log = createResearchLog(response, 'human-team', 'ai-team', ['move 1'])
    log = flagTurn(log, 8, 'Surf', 'Bad attack', 'obvious immunity')
    log = finalizeLog(log, response, {strength: 'Weak', irrational: true, cheating: false})
    const roundTrip = JSON.parse(JSON.stringify(log))
    expect(roundTrip.flags[0]).toMatchObject({battle_id: 'b-1', turn: 8, chosen_ai_action: 'Surf', category: 'Bad attack'})
    expect(roundTrip.feedback.cheating).toBe(false); expect(roundTrip.metadata.hidden_debug_state_included).toBe(false)
  })
})
