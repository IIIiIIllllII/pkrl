import type {BattleFeedback, BattleResponse, ResearchLog, TurnFlag} from '../types'

const ARCHIVE_KEY = 'gen3-lut-playtest-archive-v1'
const ACTIVE_KEY = 'gen3-lut-playtest-active-v1'
export const RESEARCH_LOG_VERSION = 4
/** Free-text limits, enforced by the inputs and again by the collector. */
export const FLAG_COMMENT_MAX = 500
export const FEEDBACK_COMMENT_MAX = 2000

/**
 * A place to send finished battles later (Supabase, an internal collector, …).
 * Battle logic never calls a network itself: it hands a finished log to whatever
 * sink is installed here, so adding a backend does not touch the battle code.
 */
export interface RemoteSink {
  name: string
  submit(log: ResearchLog): Promise<void>
}
let remoteSink: RemoteSink | null = null
export function setRemoteSink(sink: RemoteSink | null): void { remoteSink = sink }
export function remoteSinkName(): string | null { return remoteSink?.name ?? null }

/** Best-effort forwarding; a sink failure must never lose the local copy. */
export async function publishLog(log: ResearchLog): Promise<{delivered: boolean; error?: string}> {
  if (!remoteSink) return {delivered: false}
  try { await remoteSink.submit(log); return {delivered: true} }
  catch (problem) { return {delivered: false, error: problem instanceof Error ? problem.message : String(problem)} }
}

export function createResearchLog(response: BattleResponse, humanTeamId: string, aiTeamId: string, choices: string[], blind = true): ResearchLog {
  return {
    metadata: {
      battle_id: response.battle_id, timestamp: new Date().toISOString(), random_seed: response.seed,
      simulator_version: response.simulator, feature_schema: response.feature_schema,
      hidden_policy_id: response.policy_id, policy_provenance: response.policy_provenance,
      blind_checkpoint_test: blind,
      human_team_id: humanTeamId, ai_team_id: aiTeamId, final_winner: response.winner,
      turn_count: response.turn, research_log_version: RESEARCH_LOG_VERSION,
      hidden_debug_state_included: false,
    },
    ai_decisions: response.ai_decisions, human_actions: response.human_actions,
    human_choices: choices, public_log: response.public_log, flags: [],
  }
}

export function flagTurn(log: ResearchLog, turn: number, chosen: string, category?: string, comment?: string): ResearchLog {
  const flag: TurnFlag = {
    battle_id: String(log.metadata.battle_id), turn, policy_id: String(log.metadata.hidden_policy_id || ''),
    chosen_ai_action: chosen, category, comment, created_at: new Date().toISOString(),
  }
  return {...log, flags: [...log.flags, flag]}
}

export function finalizeLog(log: ResearchLog, response: BattleResponse, feedback?: BattleFeedback): ResearchLog {
  return {
    ...log,
    // A battle started under an older log version is finished under this one.
    metadata: {...log.metadata, final_winner: response.winner, turn_count: response.turn, battle_complete: response.terminal,
      research_log_version: RESEARCH_LOG_VERSION},
    ai_decisions: response.ai_decisions, human_actions: response.human_actions,
    public_log: response.public_log, feedback,
  }
}

/** The research log itself, without this browser's upload bookkeeping. */
export function researchPayload(log: ResearchLog): ResearchLog {
  const {remote_submission: _local, ...payload} = log
  return payload
}

export function loadArchive(): ResearchLog[] {
  try { const value = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}
/**
 * Persist a battle locally. Playtest data is the whole point of this tool, so a
 * failed write is reported rather than swallowed: the caller tells the tester to
 * download the battle instead of losing it.
 */
export function saveToArchive(log: ResearchLog): {saved: boolean; error?: string} {
  const archive = loadArchive(); const index = archive.findIndex(item => item.metadata.battle_id === log.metadata.battle_id)
  // Re-saving a battle (a later flag or feedback) keeps its upload bookkeeping.
  const remote = log.remote_submission ?? (index >= 0 ? archive[index].remote_submission : undefined)
  const entry = remote ? {...log, remote_submission: remote} : researchPayload(log)
  if (index >= 0) archive[index] = entry; else archive.push(entry)
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); return {saved: true} }
  catch (problem) { return {saved: false, error: problem instanceof Error ? problem.message : String(problem)} }
}
export function saveActive(value: unknown): void {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(value)) } catch { /* quota exhausted */ }
}
export function clearActive(): void { localStorage.removeItem(ACTIVE_KEY) }
export function loadActive<T>(): T | null { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null') as T } catch { return null } }

function download(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], {type})
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}

export function downloadJson(filename: string, value: unknown): void {
  download(filename, JSON.stringify(value, null, 2) + '\n', 'application/json')
}

/** One JSON object per line, so a bundle can be streamed into a warehouse. */
export function toJsonl(logs: ResearchLog[]): string {
  return logs.map(log => JSON.stringify(researchPayload(log))).join('\n') + (logs.length ? '\n' : '')
}
export function downloadJsonl(filename: string, logs: ResearchLog[]): void {
  download(filename, toJsonl(logs), 'application/x-ndjson')
}

export async function copyJson(value: unknown): Promise<void> { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)) }
