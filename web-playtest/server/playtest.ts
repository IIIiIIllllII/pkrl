import {CLEAN_POLICY_IDS, PINNED_SHOWDOWN_COMMIT} from '../src/policy/inference'
import {QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {SCHEMA_VERSION} from '../src/policy/schema'
import {teamById} from '../src/data/teams'
import {FLAG_LABELS, STRENGTH_LABELS} from '../src/i18n'
import {FEEDBACK_COMMENT_MAX, FLAG_COMMENT_MAX, RESEARCH_LOG_VERSION} from '../src/research/logging'
import type {ResearchLog} from '../src/types'

/**
 * Remote playtest collector: `POST /api/playtest`.
 *
 * The request body is untrusted internet input. It must be a finished
 * ResearchLog exactly as the client already builds it, so the validator below is
 * an allowlist of that shape: an unknown key anywhere it matters is rejected
 * rather than stored, which keeps simulator-private or otherwise hidden state
 * out of the research database. Nothing about the requester (IP, headers,
 * cookies) is stored.
 */

export const MAX_BODY_BYTES = 1_500_000
const MAX_DECISIONS = 1000
const MAX_LOG_LINES = 20_000
const MAX_LINE_LENGTH = 2000
const MAX_FLAGS = 200
const CHOICE = /^(move|switch) [1-6]$/
const BATTLE_ID = /^[-a-zA-Z0-9]{1,80}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ANONYMOUS_SWITCH = /^Switch option \d$/

export type ErrorCode =
  | 'method_not_allowed' | 'unsupported_media_type' | 'payload_too_large' | 'invalid_json' | 'invalid_submission'
  | 'contaminated_policy' | 'unknown_policy' | 'forbidden_origin' | 'rate_limited' | 'submission_conflict'
  | 'collector_unavailable' | 'storage_error'

class Invalid extends Error {
  constructor(readonly code: ErrorCode = 'invalid_submission') { super(code) }
}

/** Searchable columns plus the untouched log; nothing about the requester. */
export interface SubmissionRecord {
  submission_id: string
  revision: number
  battle_id: string
  created_at: string
  policy_id: string
  schema_version: string
  research_log_version: number
  result: 'human_win' | 'ai_win' | 'tie'
  turn_count: number
  flagged_turn_count: number
  has_feedback: boolean
  app_commit: string | null
  payload: ResearchLog
}

export type StoreResult = 'inserted' | 'updated' | 'duplicate' | 'conflict'
export interface SubmissionStore { submit(record: SubmissionRecord): Promise<StoreResult> }

// ---------------------------------------------------------------- validation

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

function object(value: unknown, allowed: readonly string[], required: readonly string[] = []): Json {
  if (!isObject(value)) throw new Invalid()
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Invalid()
  for (const key of required) if (!(key in value)) throw new Invalid()
  return value
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Invalid()
  return value
}
function string(value: unknown, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length > max || (pattern && !pattern.test(value))) throw new Invalid()
  return value
}
function optionalString(value: unknown, max: number): void { if (value !== undefined && value !== null) string(value, max) }
function integer(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Invalid()
  return value as number
}
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Invalid(); return value }
function timestamp(value: unknown): string {
  const text = string(value, 40)
  if (Number.isNaN(Date.parse(text))) throw new Invalid()
  return new Date(text).toISOString()
}

const METADATA_KEYS = ['battle_id', 'timestamp', 'random_seed', 'simulator_version', 'feature_schema', 'hidden_policy_id',
  'policy_provenance', 'blind_checkpoint_test', 'human_team_id', 'ai_team_id', 'final_winner', 'turn_count',
  'research_log_version', 'hidden_debug_state_included', 'battle_complete'] as const
const PROVENANCE_KEYS = ['policy_id', 'schema_version', 'semantics_revision', 'generation', 'checkpoint_decisions',
  'milestone_decisions', 'checkpoint_sha256', 'parameter_count', 'quantization_mode', 'quantization_scale',
  'project_commit', 'pokemon_showdown_commit', 'evaluation']
const DECISION_KEYS = ['battle_id', 'policy_id', 'turn', 'observation', 'public_state', 'legal_actions', 'legal_action_mask',
  'candidates', 'chosen_action', 'resolved_defender_types', 'top1_score', 'top2_score', 'top2_index', 'margin',
  'quantized_top1_score', 'quantized_selected_action', 'resulting_visible_events', 'answer_availability']
/** The AI observation's public-only shape, pinned by the hidden-information tests. */
const OBSERVATION_KEYS = ['turn', 'own_active', 'target', 'weather', 'moves', 'available_switch_count']
const TARGET_KEYS = ['species', 'hpBucket', 'status', 'types', 'estimatedSpeed']
const CANDIDATE_KEYS = ['index', 'label', 'kind', 'legal', 'score', 'quantized_score', 'feature_ids', 'feature_categories',
  'activated_feature_ids', 'contributions', 'move_role', 'move_class', 'applicable', 'effectiveness']
const PUBLIC_STATE_KEYS = ['perspective', 'turn', 'weather', 'self', 'opponent']
const SIDE_KEYS = ['player', 'name', 'active', 'conditions', 'revealed']
const ACTIVE_KEYS = ['species', 'hp_percent', 'hp', 'status', 'fainted', 'boosts', 'volatiles']
const HUMAN_ACTION_KEYS = ['turn', 'choice', 'label', 'kind', 'public_state']
const FLAG_KEYS = ['battle_id', 'turn', 'policy_id', 'chosen_ai_action', 'category', 'comment', 'created_at']
const FEEDBACK_KEYS = ['strength', 'irrational', 'cheating', 'comment']

function checkPublicState(value: unknown, perspective: 'p1' | 'p2'): void {
  const state = object(value, PUBLIC_STATE_KEYS, PUBLIC_STATE_KEYS)
  if (state.perspective !== perspective) throw new Invalid()
  for (const key of ['self', 'opponent'] as const) {
    const side = object(state[key], SIDE_KEYS, SIDE_KEYS)
    if (side.active !== null) {
      const active = object(side.active, ACTIVE_KEYS)
      // Exact HP is only ever the viewer's own.
      if (key === 'opponent' && 'hp' in active) throw new Invalid()
    }
    array(side.conditions, 20); array(side.revealed, 6)
  }
}

function checkAction(value: unknown, requireAnonymousSwitch: boolean): void {
  const action = object(value, ['index', 'choice', 'label', 'kind'], ['index', 'label', 'kind'])
  const label = string(action.label, 100)
  // AI switch options stay anonymized; a named switch would reveal the AI's bench.
  if (requireAnonymousSwitch && action.kind === 'switch' && !ANONYMOUS_SWITCH.test(label)) throw new Invalid()
}

function checkDecision(value: unknown, battleId: string, policyId: string): void {
  const decision = object(value, DECISION_KEYS, ['battle_id', 'policy_id', 'turn', 'observation', 'legal_actions', 'candidates', 'chosen_action'])
  if (decision.battle_id !== battleId || decision.policy_id !== policyId) throw new Invalid()
  integer(decision.turn, 0, 1000)
  const observation = object(decision.observation, OBSERVATION_KEYS)
  if (observation.target !== null && observation.target !== undefined) object(observation.target, TARGET_KEYS)
  if (decision.public_state !== undefined) checkPublicState(decision.public_state, 'p2')
  for (const action of array(decision.legal_actions, 9)) checkAction(action, true)
  for (const candidate of [...array(decision.candidates, 9), decision.chosen_action]) {
    const checked = object(candidate, CANDIDATE_KEYS, ['index', 'label', 'kind'])
    checkAction({index: checked.index, label: checked.label, kind: checked.kind}, true)
  }
  for (const line of array(decision.resulting_visible_events ?? [], MAX_LOG_LINES)) string(line, MAX_LINE_LENGTH)
}

/** Validate an untrusted submission body and derive its searchable columns. */
export function validateSubmission(body: unknown, appCommit: string | null): SubmissionRecord {
  const submission = object(body, ['submission_id', 'revision', 'log'], ['submission_id', 'revision', 'log'])
  const submissionId = string(submission.submission_id, 36, UUID).toLowerCase()
  const revision = integer(submission.revision, 1, 10_000)
  const log = object(submission.log, ['metadata', 'ai_decisions', 'human_actions', 'human_choices', 'public_log', 'flags', 'feedback'],
    ['metadata', 'ai_decisions', 'human_actions', 'human_choices', 'public_log', 'flags'])
  const metadata = object(log.metadata, METADATA_KEYS, METADATA_KEYS.filter(key => key !== 'final_winner'))

  const policyId = string(metadata.hidden_policy_id, 40)
  if ((QUARANTINED_POLICY_IDS as readonly string[]).includes(policyId)) throw new Invalid('contaminated_policy')
  if (!(CLEAN_POLICY_IDS as readonly string[]).includes(policyId)) throw new Invalid('unknown_policy')
  const provenance = object(metadata.policy_provenance, PROVENANCE_KEYS, ['policy_id', 'schema_version', 'pokemon_showdown_commit'])
  if (provenance.policy_id !== policyId || provenance.schema_version !== SCHEMA_VERSION
    || provenance.pokemon_showdown_commit !== PINNED_SHOWDOWN_COMMIT
    || (provenance.generation !== undefined && provenance.generation !== 'clean-v1.1')) throw new Invalid()

  const battleId = string(metadata.battle_id, 80, BATTLE_ID)
  const createdAt = timestamp(metadata.timestamp)
  const seed = array(metadata.random_seed, 4); if (seed.length !== 4) throw new Invalid()
  seed.forEach(value => integer(value, 0, 65535))
  if (!string(metadata.simulator_version, 200).startsWith(`pokemon-showdown@${PINNED_SHOWDOWN_COMMIT}/`)) throw new Invalid()
  if (metadata.feature_schema !== SCHEMA_VERSION) throw new Invalid()
  if (metadata.research_log_version !== RESEARCH_LOG_VERSION) throw new Invalid()
  // Only finished battles, and never a log that admits to carrying debug state.
  if (metadata.hidden_debug_state_included !== false || metadata.battle_complete !== true) throw new Invalid()
  bool(metadata.blind_checkpoint_test)
  if (!teamById(string(metadata.human_team_id, 60)) || !teamById(string(metadata.ai_team_id, 60))) throw new Invalid()
  const winner = metadata.final_winner ?? null
  if (winner !== null && winner !== 'Human' && winner !== 'AI') throw new Invalid()
  const turnCount = integer(metadata.turn_count, 0, 1000)

  for (const decision of array(log.ai_decisions, MAX_DECISIONS)) checkDecision(decision, battleId, policyId)
  for (const value of array(log.human_actions, MAX_DECISIONS)) {
    const action = object(value, HUMAN_ACTION_KEYS, ['turn', 'choice', 'label', 'kind'])
    integer(action.turn, 0, 1000); string(action.choice, 10, CHOICE); string(action.label, 100)
    if (action.public_state !== undefined) checkPublicState(action.public_state, 'p1')
  }
  for (const choice of array(log.human_choices, 500)) string(choice, 10, CHOICE)
  for (const line of array(log.public_log, MAX_LOG_LINES)) {
    if (!string(line, MAX_LINE_LENGTH).startsWith('|')) throw new Invalid()
  }

  const flaggedTurns = new Set<number>()
  for (const value of array(log.flags, MAX_FLAGS)) {
    const flag = object(value, FLAG_KEYS, ['battle_id', 'turn', 'policy_id', 'chosen_ai_action', 'created_at'])
    if (flag.battle_id !== battleId || flag.policy_id !== policyId) throw new Invalid()
    flaggedTurns.add(integer(flag.turn, 0, 1000))
    string(flag.chosen_ai_action, 100); timestamp(flag.created_at)
    if (flag.category !== undefined && flag.category !== null && !Object.hasOwn(FLAG_LABELS, string(flag.category, 60))) throw new Invalid()
    optionalString(flag.comment, FLAG_COMMENT_MAX)
  }
  let hasFeedback = false
  if (log.feedback !== undefined && log.feedback !== null) {
    const feedback = object(log.feedback, FEEDBACK_KEYS)
    if (feedback.strength !== undefined && !Object.hasOwn(STRENGTH_LABELS, string(feedback.strength, 40))) throw new Invalid()
    if (feedback.irrational !== undefined) bool(feedback.irrational)
    if (feedback.cheating !== undefined) bool(feedback.cheating)
    optionalString(feedback.comment, FEEDBACK_COMMENT_MAX)
    hasFeedback = Object.values(feedback).some(value => value !== undefined && value !== '')
  }

  return {
    submission_id: submissionId, revision, battle_id: battleId, created_at: createdAt, policy_id: policyId,
    schema_version: SCHEMA_VERSION, research_log_version: RESEARCH_LOG_VERSION,
    result: winner === 'Human' ? 'human_win' : winner === 'AI' ? 'ai_win' : 'tie',
    turn_count: turnCount, flagged_turn_count: flaggedTurns.size, has_feedback: hasFeedback,
    app_commit: appCommit, payload: log as unknown as ResearchLog,
  }
}

// ---------------------------------------------------------------- storage

/** Supabase (PostgREST) store. The key is server-side only and every value is a JSON parameter to one SQL function. */
export function supabaseStore(url: string, key: string, fetcher: typeof fetch = fetch): SubmissionStore {
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/rpc/submit_playtest`
  const headers: Record<string, string> = {'content-type': 'application/json', apikey: key}
  // Legacy service_role keys are JWTs and go in Authorization; newer sb_secret_ keys are apikey-only.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`
  return {
    async submit(record) {
      const response = await fetcher(endpoint, {method: 'POST', headers, body: JSON.stringify({
        p_submission_id: record.submission_id, p_revision: record.revision, p_battle_id: record.battle_id,
        p_created_at: record.created_at, p_policy_id: record.policy_id, p_schema_version: record.schema_version,
        p_research_log_version: record.research_log_version, p_result: record.result, p_turn_count: record.turn_count,
        p_flagged_turn_count: record.flagged_turn_count, p_has_feedback: record.has_feedback,
        p_app_commit: record.app_commit, p_payload: record.payload,
      })})
      if (!response.ok) throw new Error(`storage responded ${response.status}`)
      const result = await response.json()
      if (!['inserted', 'updated', 'duplicate', 'conflict'].includes(result)) throw new Error('unexpected storage result')
      return result as StoreResult
    },
  }
}

/** Same semantics as the SQL function; used by tests and by `npm run dev` without Supabase credentials. */
export function memoryStore(): SubmissionStore & {records: Map<string, SubmissionRecord>} {
  const records = new Map<string, SubmissionRecord>()
  return {
    records,
    async submit(record) {
      const existing = records.get(record.submission_id)
      if (!existing) { records.set(record.submission_id, structuredClone(record)); return 'inserted' }
      if (existing.battle_id !== record.battle_id) return 'conflict'
      if (existing.revision >= record.revision) return 'duplicate'
      records.set(record.submission_id, structuredClone(record)); return 'updated'
    },
  }
}

// ---------------------------------------------------------------- rate limit

/**
 * Best-effort, per-instance fixed-window limiter. Client addresses are held only
 * in memory for one window and are never written to storage.
 */
export function rateLimiter(limit = 30, windowMs = 60_000, now: () => number = Date.now) {
  const hits = new Map<string, {start: number; count: number}>()
  return (client: string): boolean => {
    const time = now()
    if (hits.size > 10_000) for (const [key, value] of hits) if (time - value.start >= windowMs) hits.delete(key)
    const entry = hits.get(client)
    if (!entry || time - entry.start >= windowMs) { hits.set(client, {start: time, count: 1}); return true }
    entry.count++
    return entry.count <= limit
  }
}

// ---------------------------------------------------------------- handler

const RESPONSE_HEADERS = {'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff'}
const reply = (status: number, body: Json) => new Response(JSON.stringify(body), {status, headers: RESPONSE_HEADERS})
const failure = (status: number, error: ErrorCode) => reply(status, {ok: false, error})

export interface CollectorOptions {
  store: SubmissionStore | null
  appCommit?: string | null
  allow?: (client: string) => boolean
}

function sameOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === (request.headers.get('host') || new URL(request.url).host) } catch { return false }
}

export function createPlaytestHandler(options: CollectorOptions): (request: Request) => Promise<Response> {
  const allow = options.allow ?? rateLimiter()
  const appCommit = options.appCommit ?? null
  return async request => {
    if (request.method !== 'POST') return failure(405, 'method_not_allowed')
    if (!sameOrigin(request)) return failure(403, 'forbidden_origin')
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return failure(415, 'unsupported_media_type')
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return failure(413, 'payload_too_large')
    const client = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
    if (!allow(client)) return failure(429, 'rate_limited')
    if (!options.store) return failure(503, 'collector_unavailable')

    let text: string
    try { text = await request.text() } catch { return failure(400, 'invalid_json') }
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return failure(413, 'payload_too_large')
    // PostgreSQL JSONB cannot hold NUL characters; reject instead of failing in storage.
    if (text.includes('\\u0000')) return failure(400, 'invalid_submission')
    let body: unknown
    try { body = JSON.parse(text) } catch { return failure(400, 'invalid_json') }

    let record: SubmissionRecord
    try { record = validateSubmission(body, appCommit) }
    catch (problem) { return failure(400, problem instanceof Invalid ? problem.code : 'invalid_submission') }

    let result: StoreResult
    try { result = await options.store.submit(record) }
    catch {
      console.error('[playtest] storage request failed')
      return failure(502, 'storage_error')
    }
    if (result === 'conflict') return failure(409, 'submission_conflict')
    if (result === 'inserted') return reply(201, {ok: true, submission_id: record.submission_id, duplicate: false})
    return reply(200, {ok: true, submission_id: record.submission_id, duplicate: result === 'duplicate', updated: result === 'updated'})
  }
}

/** Handler configured from server-side environment variables only. */
export function createPlaytestHandlerFromEnv(env: Record<string, string | undefined>, fallback: SubmissionStore | null = null) {
  const url = env.SUPABASE_URL?.trim(); const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const store = url && key ? supabaseStore(url, key) : fallback
  return createPlaytestHandler({store, appCommit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) || null})
}
