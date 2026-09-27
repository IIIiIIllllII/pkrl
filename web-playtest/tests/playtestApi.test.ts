import {beforeAll, describe, expect, it, vi} from 'vitest'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {
  createPlaytestHandler, MAX_BODY_BYTES, memoryStore, rateLimiter, supabaseStore, validateSubmission,
  type SubmissionStore,
} from '../server/playtest'
import playtestFunction from '../api/playtest.mjs'
import {fetchSubmissions, formatSubmissions} from '../scripts/export-playtests.mjs'
import {POLICY_IDS, QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {FEEDBACK_COMMENT_MAX, FLAG_COMMENT_MAX} from '../src/research/logging'
import type {ResearchLog} from '../src/types'
import {finishedLog} from './helpers/finishedLog'

const ORIGIN = 'https://playtest.example'
const SUBMISSION_ID = '0b7c1f9e-2d4a-4c1b-9f3e-5a6b7c8d9e0f'
let log: ResearchLog

beforeAll(async () => { log = await finishedLog() })

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request(`${ORIGIN}/api/playtest`, {method: 'POST', body: text,
    headers: {'content-type': 'application/json', host: 'playtest.example', origin: ORIGIN, 'x-forwarded-for': '203.0.113.9', ...headers}})
}
const submission = (overrides: Record<string, unknown> = {}, logValue: unknown = log) => ({submission_id: SUBMISSION_ID, revision: 1, log: logValue, ...overrides})
const clone = <T>(value: T): T => structuredClone(value)
function collector(store: SubmissionStore | null = memoryStore()) {
  return createPlaytestHandler({store, appCommit: 'abc123', allow: () => true})
}
async function send(handler: ReturnType<typeof collector>, request: Request) {
  const response = await handler(request)
  return {status: response.status, body: await response.json() as Record<string, unknown>}
}

describe('POST /api/playtest', () => {
  it('stores a real finished log with its flags and feedback intact', async () => {
    const store = memoryStore(); const handler = collector(store)
    const {status, body} = await send(handler, post(submission()))
    expect(status).toBe(201)
    expect(body).toEqual({ok: true, submission_id: SUBMISSION_ID, duplicate: false})
    const record = store.records.get(SUBMISSION_ID)!
    expect(record.payload).toEqual(log)
    expect(record.payload.flags).toEqual(log.flags)
    expect(record.payload.flags[0].comment).toBe('Tackle into <b>Swampert</b>?')
    expect(record.payload.feedback).toEqual({strength: 'Weak', irrational: false, cheating: false, comment: 'felt passive'})
    expect(record.payload.ai_decisions[0].public_state).toBeDefined()
    expect(record).toMatchObject({battle_id: 'remote-battle', policy_id: 'v1.1-100m', schema_version: 'gen3-lut-v1.1',
      result: 'human_win', flagged_turn_count: 1, has_feedback: true, revision: 1, app_commit: 'abc123'})
    // Nothing about the requester is stored.
    expect(Object.keys(record).sort()).toEqual(['app_commit', 'battle_id', 'created_at', 'flagged_turn_count', 'has_feedback',
      'payload', 'policy_id', 'research_log_version', 'result', 'revision', 'schema_version', 'submission_id', 'turn_count'])
    expect(JSON.stringify(record)).not.toContain('203.0.113.9')
  })

  it('is idempotent per submission_id and applies later revisions in place', async () => {
    const store = memoryStore(); const handler = collector(store)
    expect((await send(handler, post(submission()))).status).toBe(201)
    const again = await send(handler, post(submission()))
    expect(again).toEqual({status: 200, body: {ok: true, submission_id: SUBMISSION_ID, duplicate: true, updated: false}})
    expect(store.records.size).toBe(1)
    const revised = clone(log); revised.feedback = {...revised.feedback, comment: 'changed my mind'}
    const update = await send(handler, post(submission({revision: 2}, revised)))
    expect(update).toEqual({status: 200, body: {ok: true, submission_id: SUBMISSION_ID, duplicate: false, updated: true}})
    expect(store.records.size).toBe(1)
    expect(store.records.get(SUBMISSION_ID)!.payload.feedback?.comment).toBe('changed my mind')
    // A stale revision never overwrites a newer one.
    expect((await send(handler, post(submission({revision: 1})))).body.duplicate).toBe(true)
    expect(store.records.get(SUBMISSION_ID)!.revision).toBe(2)
    // Reusing a submission_id for another battle is refused.
    const other = clone(log); other.metadata.battle_id = 'another-battle'
    for (const decision of other.ai_decisions) decision.battle_id = 'another-battle'
    for (const flag of other.flags) flag.battle_id = 'another-battle'
    expect(await send(handler, post(submission({revision: 3}, other)))).toEqual({status: 409, body: {ok: false, error: 'submission_conflict'}})
  })

  it('accepts only clean v1.1 checkpoints and names contaminated v1 explicitly', async () => {
    for (const id of POLICY_IDS) {
      const clean = await finishedLog(`clean-${id.replace('.', '-')}`, id)
      expect((await send(collector(), post(submission({}, clean)))).status).toBe(201)
    }
    for (const id of QUARANTINED_POLICY_IDS) {
      const contaminated = clone(log); contaminated.metadata.hidden_policy_id = id
      expect(await send(collector(), post(submission({}, contaminated)))).toEqual({status: 400, body: {ok: false, error: 'contaminated_policy'}})
    }
    for (const id of ['v1.1-10m', 'v2-100m', '']) {
      const unknown = clone(log); unknown.metadata.hidden_policy_id = id
      expect((await send(collector(), post(submission({}, unknown)))).body.error).toBe('unknown_policy')
    }
    // Provenance must agree with the claimed checkpoint.
    const mismatched = clone(log); (mismatched.metadata.policy_provenance as Record<string, unknown>).policy_id = 'v1.1-20m'
    expect((await send(collector(), post(submission({}, mismatched)))).body.error).toBe('invalid_submission')
  })

  it('rejects malformed requests with stable codes', async () => {
    const handler = collector()
    const cases: Array<[Request, number, string]> = [
      [post('{not json'), 400, 'invalid_json'],
      [post([]), 400, 'invalid_submission'],
      [post({submission_id: SUBMISSION_ID, revision: 1}), 400, 'invalid_submission'],
      [post(submission({submission_id: 'not-a-uuid'})), 400, 'invalid_submission'],
      [post(submission({revision: 0})), 400, 'invalid_submission'],
      [post(submission({extra: true})), 400, 'invalid_submission'],
      [post(submission(), {'content-type': 'text/plain'}), 415, 'unsupported_media_type'],
      [new Request(`${ORIGIN}/api/playtest`, {method: 'GET'}), 405, 'method_not_allowed'],
    ]
    for (const [request, status, error] of cases) expect(await send(handler, request)).toEqual({status, body: {ok: false, error}})
    for (const mutate of [
      (value: ResearchLog) => { value.metadata.battle_complete = false },
      (value: ResearchLog) => { delete value.metadata.battle_complete },
      (value: ResearchLog) => { value.metadata.research_log_version = 2 },
      (value: ResearchLog) => { value.metadata.feature_schema = 'gen3-lut-v1' },
      (value: ResearchLog) => { value.metadata.timestamp = 'yesterday' },
      (value: ResearchLog) => { value.flags[0].category = 'Not a category' },
      (value: ResearchLog) => { (value.feedback as Record<string, unknown>).strength = 'Godlike' },
      (value: ResearchLog) => { value.human_choices.push('move 9') },
      (value: ResearchLog) => { value.public_log.push('<script>alert(1)</script>') },
    ]) {
      const broken = clone(log); mutate(broken)
      expect(await send(handler, post(submission({}, broken)))).toEqual({status: 400, body: {ok: false, error: 'invalid_submission'}})
    }
  })

  it('never reflects submitted text into an error', async () => {
    const hostile = clone(log); hostile.metadata.hidden_policy_id = '<img src=x onerror=alert(1)>'
    const response = await collector()(post(submission({}, hostile)))
    const text = await response.text()
    expect(text).toBe('{"ok":false,"error":"unknown_policy"}')
  })

  it('enforces comment and payload size limits', async () => {
    const handler = collector()
    const longFlag = clone(log); longFlag.flags[0].comment = 'x'.repeat(FLAG_COMMENT_MAX + 1)
    expect((await send(handler, post(submission({}, longFlag)))).status).toBe(400)
    const okFlag = clone(log); okFlag.flags[0].comment = 'x'.repeat(FLAG_COMMENT_MAX)
    expect((await send(handler, post(submission({}, okFlag)))).status).toBe(201)
    const longFeedback = clone(log); longFeedback.feedback!.comment = 'y'.repeat(FEEDBACK_COMMENT_MAX + 1)
    expect((await send(handler, post(submission({submission_id: '1b7c1f9e-2d4a-4c1b-9f3e-5a6b7c8d9e0f'}, longFeedback)))).status).toBe(400)
    const huge = clone(log); huge.public_log = Array.from({length: 1000}, () => `|${'z'.repeat(1990)}`)
    expect(await send(handler, post(submission({}, huge)))).toEqual({status: 413, body: {ok: false, error: 'payload_too_large'}})
    expect((await send(handler, post(submission(), {'content-length': String(MAX_BODY_BYTES + 1)}))).status).toBe(413)
    const nul = JSON.stringify(submission()).replace('felt passive', 'felt\\u0000passive')
    expect((await send(handler, post(nul))).body.error).toBe('invalid_submission')
  })

  it('rejects anything that would add hidden or simulator-private state', async () => {
    const handler = collector()
    for (const mutate of [
      (value: any) => { value.ai_decisions[0].developer_hidden_state = {bench: ['Rattata']} },
      (value: any) => { value.request = {side: {pokemon: []}} },
      (value: any) => { value.metadata.hidden_debug_state_included = true },
      (value: any) => { value.metadata.omniscient_log = [] },
      (value: any) => { value.ai_decisions[0].observation.request = {} },
      (value: any) => { value.ai_decisions[0].observation.target.item = 'Leftovers' },
      (value: any) => { value.ai_decisions[0].legal_actions.push({index: 4, choice: 'switch 2', label: 'Switch to Rattata', kind: 'switch'}) },
      (value: any) => { value.ai_decisions[0].candidates[4].label = 'Switch to Rattata' },
      (value: any) => { value.ai_decisions[0].public_state.opponent.active.hp = [300, 341] },
      (value: any) => { value.human_actions[0].public_state.opponent.active.hp = [10, 20] },
      (value: any) => { value.ai_decisions[0].public_state.self.active.item = 'Choice Band' },
      (value: any) => { value.remote_submission = {submission_id: SUBMISSION_ID} },
    ]) {
      const tampered = clone(log); mutate(tampered)
      expect(await send(handler, post(submission({}, tampered)))).toEqual({status: 400, body: {ok: false, error: 'invalid_submission'}})
    }
    // The genuine log never reveals the AI's unrevealed bench, item or ability.
    const serialized = JSON.stringify(validateSubmission(submission(), null).payload.ai_decisions.map(decision => [decision.observation, decision.public_state]))
    expect(serialized).not.toContain('Lum Berry'); expect(serialized).not.toContain('Run Away')
  })

  it('refuses cross-origin use, rate-limits, and fails closed without storage', async () => {
    const handler = collector()
    expect((await send(handler, post(submission(), {origin: 'https://evil.example'}))).body.error).toBe('forbidden_origin')
    expect((await send(handler, post(submission(), {'sec-fetch-site': 'cross-site'}))).status).toBe(403)
    const limited = createPlaytestHandler({store: memoryStore(), allow: rateLimiter(2, 60_000, () => 0)})
    expect((await limited(post(submission()))).status).toBe(201)
    expect((await limited(post(submission()))).status).toBe(200)
    expect(await send(limited, post(submission()))).toEqual({status: 429, body: {ok: false, error: 'rate_limited'}})
    expect(await send(collector(null), post(submission()))).toEqual({status: 503, body: {ok: false, error: 'collector_unavailable'}})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = collector({submit: async () => { throw new Error('password=hunter2 relation does not exist') }})
    const response = await broken(post(submission()))
    expect(response.status).toBe(502)
    expect(await response.text()).toBe('{"ok":false,"error":"storage_error"}')
    error.mockRestore()
  })

  it('calls one parameterized Supabase function with a server-side key', async () => {
    const calls: Array<{url: string; init: RequestInit}> = []
    const fake = (async (url: string, init: RequestInit) => { calls.push({url, init}); return Response.json('inserted') }) as typeof fetch
    const store = supabaseStore('https://project.supabase.co/', 'eyJlegacy.service.role', fake)
    const record = validateSubmission(submission(), 'abc123')
    expect(await store.submit(record)).toBe('inserted')
    expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/rpc/submit_playtest')
    expect(calls[0].init.headers).toMatchObject({apikey: 'eyJlegacy.service.role', authorization: 'Bearer eyJlegacy.service.role'})
    const params = JSON.parse(String(calls[0].init.body))
    expect(params).toMatchObject({p_submission_id: SUBMISSION_ID, p_revision: 1, p_policy_id: 'v1.1-100m', p_result: 'human_win'})
    expect(params.p_payload).toEqual(log)
    const secret = supabaseStore('https://project.supabase.co', 'sb_secret_abc', fake)
    await secret.submit(record)
    expect(calls[1].init.headers).not.toHaveProperty('authorization')
    const failing = supabaseStore('https://project.supabase.co', 'k', (async () => new Response('boom', {status: 500})) as typeof fetch)
    await expect(failing.submit(record)).rejects.toThrow(/storage responded 500/)
  })

  it('serves the deployed bundle through the Vercel function', async () => {
    // No credentials in the test environment: the deployed function fails closed.
    const response = await playtestFunction.fetch(post(submission()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ok: false, error: 'collector_unavailable'})
  })
})

describe('offline export of collected submissions', () => {
  it('pages through every row and preserves each ResearchLog payload exactly', async () => {
    const rows = Array.from({length: 501}, (_, index) => ({submission_id: `id-${index}`, revision: 1, payload: {...log, metadata: {...log.metadata, battle_id: `b-${index}`}}}))
    const urls: string[] = []
    const fake = async (url: string) => {
      urls.push(url); const offset = Number(new URL(url).searchParams.get('offset'))
      return Response.json(rows.slice(offset, offset + 500))
    }
    const fetched = await fetchSubmissions({url: 'https://project.supabase.co', key: 'sb_secret_abc', policy: 'v1.1-100m', fetcher: fake})
    expect(fetched).toHaveLength(501)
    expect(urls).toHaveLength(2)
    expect(new URL(urls[0]).searchParams.get('policy_id')).toBe('eq.v1.1-100m')
    const jsonl = formatSubmissions(fetched)
    const lines = jsonl.trimEnd().split('\n')
    expect(lines).toHaveLength(501)
    expect(JSON.parse(lines[0])).toEqual(rows[0].payload)
    expect(JSON.parse(formatSubmissions(fetched.slice(0, 1), {format: 'json'})).battles[0]).toEqual(rows[0].payload)
    expect(JSON.parse(formatSubmissions(fetched.slice(0, 1), {envelope: true}))).toEqual({submission: {submission_id: 'id-0', revision: 1}, payload: rows[0].payload})
    await expect(fetchSubmissions({url: '', key: ''})).rejects.toThrow(/must be set/)
  })

  it('keeps server credentials out of browser code', () => {
    const files: string[] = []
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files.push(path) } }
    walk(join(__dirname, '../src'))
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/SUPABASE_|service_role|sb_secret_|\.supabase\.co|\/rest\/v1/)
    }
  })
})
