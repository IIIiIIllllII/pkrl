import type {BattleFeedback, BattleResponse, ResearchLog, TurnFlag} from '../types'

const ARCHIVE_KEY = 'gen3-lut-playtest-archive-v1'
const ACTIVE_KEY = 'gen3-lut-playtest-active-v1'

export function createResearchLog(response: BattleResponse, humanTeamId: string, aiTeamId: string, choices: string[]): ResearchLog {
  return {metadata: {
    battle_id: response.battle_id, timestamp: new Date().toISOString(), random_seed: response.seed,
    simulator_version: response.simulator, feature_schema: response.feature_schema, hidden_policy_id: response.policy_id,
    human_team_id: humanTeamId, ai_team_id: aiTeamId, final_winner: response.winner,
    turn_count: response.turn, research_log_version: 1, hidden_debug_state_included: false,
  }, ai_decisions: response.ai_decisions, human_choices: choices, flags: []}
}

export function flagTurn(log: ResearchLog, turn: number, chosen: string, category?: string, comment?: string): ResearchLog {
  const flag: TurnFlag = {battle_id: String(log.metadata.battle_id), turn, chosen_ai_action: chosen, category, comment, created_at: new Date().toISOString()}
  return {...log, flags: [...log.flags, flag]}
}

export function finalizeLog(log: ResearchLog, response: BattleResponse, feedback?: BattleFeedback): ResearchLog {
  return {...log, metadata: {...log.metadata, final_winner: response.winner, turn_count: response.turn}, ai_decisions: response.ai_decisions, feedback}
}

export function loadArchive(): ResearchLog[] {
  try { const value = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}
export function saveToArchive(log: ResearchLog): void {
  const archive = loadArchive(); const index = archive.findIndex(item => item.metadata.battle_id === log.metadata.battle_id)
  if (index >= 0) archive[index] = log; else archive.push(log)
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive))
}
export function saveActive(value: unknown): void { localStorage.setItem(ACTIVE_KEY, JSON.stringify(value)) }
export function clearActive(): void { localStorage.removeItem(ACTIVE_KEY) }
export function loadActive<T>(): T | null { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') as T } catch { return null } }

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'})
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}

export async function copyJson(value: unknown): Promise<void> { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)) }
