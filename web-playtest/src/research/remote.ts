import type {RemoteSubmission, ResearchLog} from '../types'
import {loadArchive, researchPayload, saveToArchive} from './logging'

/**
 * Remote collection of finished battles, layered on top of the local archive.
 *
 * The local archive stays the source of resilience: a battle is always saved in
 * this browser first, and an upload only ever updates its bookkeeping. A failed
 * or disabled upload never loses, blocks or deletes anything.
 */

export const PLAYTEST_ENDPOINT = '/api/playtest'
const OPT_OUT_KEY = 'gen3-lut-playtest-remote-opt-out-v1'
/** Upper bound on requests per upload pass, so a long backlog never floods the endpoint. */
const MAX_REQUESTS_PER_PASS = 10
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 60 * 60_000

export function remoteSubmissionEnabled(): boolean {
  try { return localStorage.getItem(OPT_OUT_KEY) !== '1' } catch { return true }
}
export function setRemoteSubmissionEnabled(enabled: boolean): void {
  try { if (enabled) localStorage.removeItem(OPT_OUT_KEY); else localStorage.setItem(OPT_OUT_KEY, '1') } catch { /* storage unavailable */ }
}

export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
}

/**
 * Save a finished battle locally and, when collection is enabled, queue it for
 * upload. A battle archived while collection was off is never uploaded later.
 * Returns the archived entry even when the local write failed, so the caller can
 * still attempt the upload as a backup.
 */
export function archiveFinalLog(log: ResearchLog, options: {remote: boolean; previous?: RemoteSubmission}): {entry: ResearchLog; saved: boolean; error?: string} {
  const payload = researchPayload(log)
  const existing = loadArchive().find(item => item.metadata.battle_id === payload.metadata.battle_id)
  // `previous` keeps the submission ID stable when an earlier local save failed.
  let remote = existing?.remote_submission ?? options.previous
  const changed = !existing || JSON.stringify(researchPayload(existing)) !== JSON.stringify(payload)
  if (!remote && options.remote && !existing) {
    remote = {submission_id: crypto.randomUUID(), revision: 1, status: 'pending', attempts: 0}
  } else if (remote && changed) {
    // Later flags or feedback change the log: upload it again as a new revision
    // of the same submission, which the collector applies in place.
    remote = {...remote, revision: remote.revision + 1, status: 'pending', next_attempt_at: undefined, last_error: undefined}
  }
  const entry: ResearchLog = remote ? {...payload, remote_submission: remote} : payload
  return {entry, ...saveToArchive(entry)}
}

export interface UploadSummary {attempted: number; uploaded: number; pending: number; failed: number}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>
type Outcome = {kind: 'uploaded'} | {kind: 'retry'; error: string} | {kind: 'rejected'; error: string}

async function submit(entry: ResearchLog, fetcher: FetchLike): Promise<Outcome> {
  const remote = entry.remote_submission!
  let response: Response
  try {
    response = await fetcher(PLAYTEST_ENDPOINT, {
      method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'omit',
      body: JSON.stringify({submission_id: remote.submission_id, revision: remote.revision, log: researchPayload(entry)}),
    })
  } catch { return {kind: 'retry', error: 'network_error'} }
  let code = `http_${response.status}`
  try {
    const body = await response.json() as {ok?: boolean; error?: unknown}
    if (response.ok && body.ok) return {kind: 'uploaded'}
    if (typeof body.error === 'string' && /^[a-z_]{1,40}$/.test(body.error)) code = body.error
  } catch { /* non-JSON response */ }
  // Validation failures will fail again unchanged; server, rate-limit and
  // availability problems are worth retrying later.
  const permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)
  return permanent ? {kind: 'rejected', error: code} : {kind: 'retry', error: code}
}

function applyOutcome(remote: RemoteSubmission, outcome: Outcome, now: number): RemoteSubmission {
  const attempts = remote.attempts + 1
  if (outcome.kind === 'uploaded') {
    return {...remote, attempts, status: 'uploaded', uploaded_revision: remote.revision, uploaded_at: new Date(now).toISOString(),
      next_attempt_at: undefined, last_error: undefined}
  }
  if (outcome.kind === 'rejected') return {...remote, attempts, status: 'failed', next_attempt_at: undefined, last_error: outcome.error}
  return {...remote, attempts, status: 'pending', next_attempt_at: new Date(now + backoffMs(attempts)).toISOString(), last_error: outcome.error}
}

/** Record an outcome unless the battle changed (a newer revision) while its upload was in flight. */
function recordOutcome(next: RemoteSubmission): void {
  const current = loadArchive().find(item => item.remote_submission?.submission_id === next.submission_id)
  if (!current || current.remote_submission!.revision !== next.revision) return
  saveToArchive({...current, remote_submission: next})
}

let inFlight: Promise<UploadSummary> | null = null

/**
 * Upload every pending battle whose backoff has elapsed (all pending ones when
 * `force` is set). Stops at the first retryable failure so an unreachable
 * collector costs one request per pass, not one per battle. `extra` covers a
 * battle whose local save failed and is therefore not in the archive.
 */
export function uploadPending(options: {fetch?: FetchLike; now?: () => number; force?: boolean; extra?: ResearchLog[]} = {}): Promise<UploadSummary> {
  if (inFlight) return inFlight
  inFlight = runUploads(options).finally(() => { inFlight = null })
  return inFlight
}

async function runUploads(options: {fetch?: FetchLike; now?: () => number; force?: boolean; extra?: ResearchLog[]}): Promise<UploadSummary> {
  const summary: UploadSummary = {attempted: 0, uploaded: 0, pending: 0, failed: 0}
  if (!remoteSubmissionEnabled()) return summary
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init))
  const now = options.now ?? Date.now
  const archived = loadArchive()
  const known = new Set(archived.map(item => item.remote_submission?.submission_id))
  const queue = [...archived, ...(options.extra || []).filter(item => !known.has(item.remote_submission?.submission_id))]
    .filter(item => item.remote_submission?.status === 'pending')
  for (const entry of queue) {
    const remote = entry.remote_submission!
    const due = options.force || !remote.next_attempt_at || Date.parse(remote.next_attempt_at) <= now()
    if (!due || summary.attempted >= MAX_REQUESTS_PER_PASS) { summary.pending++; continue }
    summary.attempted++
    const outcome = await submit(entry, fetcher)
    const next = applyOutcome(remote, outcome, now())
    entry.remote_submission = next
    recordOutcome(next)
    if (outcome.kind === 'uploaded') summary.uploaded++
    else if (outcome.kind === 'rejected') summary.failed++
    else {
      // Leave the rest for a later pass instead of hammering an unavailable collector.
      summary.pending += 1 + queue.slice(queue.indexOf(entry) + 1).length
      break
    }
  }
  return summary
}

export function pendingUploadCount(): number {
  return loadArchive().filter(item => item.remote_submission?.status === 'pending').length
}
