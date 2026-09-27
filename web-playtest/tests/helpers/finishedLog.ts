import {replayBattle} from '../../server/simulator'
import {createResearchLog, finalizeLog, flagTurn} from '../../src/research/logging'
import type {BattleApiInput, BattleResponse, ResearchLog} from '../../src/types'

/** A real finished battle from the pinned simulator, with a hidden AI bench member. */
export async function finishedBattle(battleId = 'remote-battle', policyId = 'v1.1-100m'): Promise<BattleResponse> {
  const input: BattleApiInput = {battle_id: battleId, seed: [7, 8, 9, 10], policy_id: policyId, human_team_id: 'rom-npc', ai_team_id: 'rom-npc', human_choices: []}
  const human = [{species: 'Swampert', level: 100, ability: 'Torrent', moves: ['Surf', 'Earthquake']}]
  const ai = [{species: 'Pidgey', level: 5, ability: 'Keen Eye', moves: ['Tackle']},
    {species: 'Rattata', level: 5, ability: 'Run Away', item: 'Lum Berry', moves: ['Tackle', 'Quick Attack']}]
  let result = await replayBattle(input, {human, ai})
  const choices: string[] = []
  for (let turn = 0; turn < 20 && !result.terminal; turn++) {
    choices.push(result.legal_actions[0].choice)
    result = await replayBattle({...input, human_choices: [...choices]}, {human, ai})
  }
  if (!result.terminal) throw new Error('fixture battle did not finish')
  return result
}

/** Finished log with a turn flag and end-of-battle feedback, as the app produces it. */
export async function finishedLog(battleId?: string, policyId?: string): Promise<ResearchLog> {
  const response = await finishedBattle(battleId, policyId)
  let log = createResearchLog(response, 'rom-npc', 'rom-npc', [], true)
  log = {...log, human_choices: response.human_actions.map(action => action.choice)}
  log = flagTurn(log, response.ai_decisions[0].turn, response.ai_decisions[0].chosen_action.label, 'Bad attack', 'Tackle into <b>Swampert</b>?')
  return JSON.parse(JSON.stringify(finalizeLog(log, response, {strength: 'Weak', irrational: false, cheating: false, comment: 'felt passive'})))
}
