import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

class MemoryStorage {
  private store = new Map<string, string>()
  get length(): number { return this.store.size }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string): void { this.store.set(key, String(value)) }
  removeItem(key: string): void { this.store.delete(key) }
  clear(): void { this.store.clear() }
}
Object.assign(globalThis, {Storage: MemoryStorage, localStorage: new MemoryStorage()})
import {loadArchive, saveToArchive, toJsonl} from '../src/research/logging'
import {
  archiveFinalLog, backoffMs, pendingUploadCount, PLAYTEST_ENDPOINT, remoteSubmissionEnabled,
  setRemoteSubmissionEnabled, uploadPending,
} from '../src/research/remote'
import {createPlaytestHandler, memoryStore} from '../server/playtest'
import type {ResearchLog} from '../src/types'
import {finishedLog} from './helpers/finishedLog'

const ARCHIVE_KEY = 'gen3-lut-playtest-archive-v1'
let base: ResearchLog
beforeAll(async () => { base = await finishedLog('client-battle') })
beforeEach(() => { localStorage.clear() })

const withBattle = (id: string): ResearchLog => {
  const log = structuredClone(base)
  log.metadata.battle_id = id
  for (const decision of log.ai_decisions) decision.battle_id = id
  for (const flag of log.flags) flag.battle_id = id
  return log
}
const archived = (id: string) => loadArchive().find(item => item.metadata.battle_id === id)!

type Call = {url: string; init: RequestInit}
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetcher = vi.fn(async (url: string, init: RequestInit) => { const call = {url, init}; calls.push(call); return respond(call) })
  return {fetcher, calls}
}
const accepted = () => Response.json({ok: true, submission_id: 'x', duplicate: false}, {status: 201})

/** The real client uploader talking to the real collector handler in memory. */
function liveCollector() {
  const store = memoryStore()
  const handler = createPlaytestHandler({store, allow: () => true})
  let dropNextResponse = false
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    const response = await handler(new Request(`https://playtest.example${url}`, {...init, headers: {...init.headers as Record<string, string>, host: 'playtest.example'}}))
    if (dropNextResponse) { dropNextResponse = false; throw new TypeError('connection reset after the server stored it') }
    return response
  })
  return {store, fetcher, dropResponse: () => { dropNextResponse = true }}
}

describe('remote playtest upload', () => {
  it('saves locally first, then uploads and marks the battle uploaded', async () => {
    const {entry, saved} = archiveFinalLog(withBattle('ok'), {remote: true})
    expect(saved).toBe(true)
    expect(archived('ok').remote_submission).toMatchObject({status: 'pending', revision: 1, attempts: 0})
    const {fetcher, calls} = fakeFetch(accepted)
    expect(await uploadPending({fetch: fetcher})).toEqual({attempted: 1, uploaded: 1, pending: 0, failed: 0})
    expect(calls[0].url).toBe(PLAYTEST_ENDPOINT)
    expect(calls[0].init).toMatchObject({method: 'POST', credentials: 'omit'})
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.submission_id).toBe(entry.remote_submission!.submission_id)
    expect(body.log).not.toHaveProperty('remote_submission')
    expect(body.log.flags).toEqual(base.flags.map(flag => ({...flag, battle_id: 'ok'})))
    expect(body.log.feedback).toEqual(base.feedback)
    expect(archived('ok').remote_submission).toMatchObject({status: 'uploaded', uploaded_revision: 1, attempts: 1})
    // Records remain in the local archive after a successful upload.
    expect(loadArchive()).toHaveLength(1)
  })

  it('keeps a battle locally as pending when the network fails, then retries after backoff', async () => {
    let time = 1_000_000
    archiveFinalLog(withBattle('offline'), {remote: true})
    const down = fakeFetch(() => { throw new TypeError('Failed to fetch') })
    expect(await uploadPending({fetch: down.fetcher, now: () => time})).toMatchObject({attempted: 1, pending: 1})
    const pending = archived('offline')
    expect(pending.metadata.battle_id).toBe('offline')
    expect(pending.remote_submission).toMatchObject({status: 'pending', attempts: 1, last_error: 'network_error'})
    expect(Date.parse(pending.remote_submission!.next_attempt_at!)).toBe(time + backoffMs(1))
    // Not due yet: no request at all.
    const up = fakeFetch(accepted)
    expect(await uploadPending({fetch: up.fetcher, now: () => time + 1000})).toMatchObject({attempted: 0, pending: 1})
    expect(up.calls).toHaveLength(0)
    time += backoffMs(1)
    expect(await uploadPending({fetch: up.fetcher, now: () => time})).toMatchObject({attempted: 1, uploaded: 1})
    expect(archived('offline').remote_submission?.status).toBe('uploaded')
  })

  it('makes one request per pass while the collector is down, and a manual retry ignores backoff', async () => {
    for (const id of ['a', 'b', 'c']) archiveFinalLog(withBattle(id), {remote: true})
    const down = fakeFetch(() => Response.json({ok: false, error: 'collector_unavailable'}, {status: 503}))
    expect(await uploadPending({fetch: down.fetcher})).toEqual({attempted: 1, uploaded: 0, pending: 3, failed: 0})
    expect(down.calls).toHaveLength(1)
    expect(archived('a').remote_submission?.last_error).toBe('collector_unavailable')
    expect(pendingUploadCount()).toBe(3)
    const up = fakeFetch(accepted)
    expect(await uploadPending({fetch: up.fetcher, force: true})).toMatchObject({attempted: 3, uploaded: 3})
    expect(pendingUploadCount()).toBe(0)
  })

  it('marks a validation rejection failed and does not retry it', async () => {
    archiveFinalLog(withBattle('bad'), {remote: true})
    const rejecting = fakeFetch(() => Response.json({ok: false, error: 'invalid_submission'}, {status: 400}))
    expect(await uploadPending({fetch: rejecting.fetcher})).toMatchObject({failed: 1})
    expect(archived('bad').remote_submission).toMatchObject({status: 'failed', last_error: 'invalid_submission'})
    await uploadPending({fetch: rejecting.fetcher, force: true})
    expect(rejecting.calls).toHaveLength(1)
  })

  it('re-uploads later feedback as a new revision of the same submission', async () => {
    const live = liveCollector()
    const first = archiveFinalLog(withBattle('revise'), {remote: true})
    await uploadPending({fetch: live.fetcher})
    const withFeedback = {...withBattle('revise'), feedback: {strength: 'Strong', comment: 'better than expected'}}
    const second = archiveFinalLog(withFeedback, {remote: true})
    expect(second.entry.remote_submission).toMatchObject({submission_id: first.entry.remote_submission!.submission_id, revision: 2, status: 'pending'})
    // Saving an unchanged log does not bump the revision.
    expect(archiveFinalLog(withFeedback, {remote: true}).entry.remote_submission!.revision).toBe(2)
    await uploadPending({fetch: live.fetcher})
    expect(archived('revise').remote_submission).toMatchObject({status: 'uploaded', uploaded_revision: 2})
    expect(live.store.records.size).toBe(1)
    expect([...live.store.records.values()][0].payload.feedback).toEqual({strength: 'Strong', comment: 'better than expected'})
  })

  it('does not duplicate a battle whose first upload response was lost', async () => {
    const live = liveCollector()
    archiveFinalLog(withBattle('lost-response'), {remote: true})
    live.dropResponse()
    expect(await uploadPending({fetch: live.fetcher})).toMatchObject({pending: 1})
    expect(live.store.records.size).toBe(1)
    await uploadPending({fetch: live.fetcher, force: true})
    expect(live.fetcher).toHaveBeenCalledTimes(2)
    expect(live.store.records.size).toBe(1)
    expect(archived('lost-response').remote_submission?.status).toBe('uploaded')
  })

  it('makes no network request while submission is turned off', async () => {
    expect(remoteSubmissionEnabled()).toBe(true)
    archiveFinalLog(withBattle('queued-before-opt-out'), {remote: true})
    setRemoteSubmissionEnabled(false)
    expect(remoteSubmissionEnabled()).toBe(false)
    const {entry, saved} = archiveFinalLog(withBattle('opted-out'), {remote: remoteSubmissionEnabled()})
    expect(saved).toBe(true)
    expect(entry.remote_submission).toBeUndefined()
    const {fetcher} = fakeFetch(accepted)
    expect(await uploadPending({fetch: fetcher, force: true})).toEqual({attempted: 0, uploaded: 0, pending: 0, failed: 0})
    expect(fetcher).not.toHaveBeenCalled()
    // Local logging and export still work while opted out.
    expect(toJsonl(loadArchive()).trimEnd().split('\n')).toHaveLength(2)
    setRemoteSubmissionEnabled(true)
    await uploadPending({fetch: fetcher})
    // Only the battle queued while enabled is sent; the opted-out one never is.
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetcher.mock.calls[0][1].body)).log.metadata.battle_id).toBe('queued-before-opt-out')
  })

  it('reads an archive written before remote collection and never uploads it', async () => {
    const legacy = {...withBattle('legacy'), metadata: {...withBattle('legacy').metadata, research_log_version: 2}}
    delete (legacy.metadata as Record<string, unknown>).battle_complete
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([legacy]))
    expect(loadArchive()).toEqual([legacy])
    expect(pendingUploadCount()).toBe(0)
    const {fetcher} = fakeFetch(accepted)
    await uploadPending({fetch: fetcher, force: true})
    expect(fetcher).not.toHaveBeenCalled()
    // Adding a new battle leaves the old entry untouched.
    archiveFinalLog(withBattle('new'), {remote: true})
    expect(archived('legacy')).toEqual(legacy)
    // Re-saving an old battle does not start uploading it either.
    expect(archiveFinalLog(legacy, {remote: true}).entry.remote_submission).toBeUndefined()
  })

  it('strips upload bookkeeping from JSON/JSONL exports and keeps it across re-saves', async () => {
    archiveFinalLog(withBattle('export'), {remote: true})
    const line = JSON.parse(toJsonl(loadArchive()).trim())
    expect(line).not.toHaveProperty('remote_submission')
    expect(line.metadata.battle_id).toBe('export')
    const {remote_submission: _, ...plain} = archived('export')
    saveToArchive(plain)
    expect(archived('export').remote_submission?.status).toBe('pending')
  })

  it('still uploads, with a stable submission ID, when the local save fails', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const first = archiveFinalLog(withBattle('quota'), {remote: true})
    expect(first.saved).toBe(false)
    const {fetcher} = fakeFetch(accepted)
    await uploadPending({fetch: fetcher, extra: [first.entry]})
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(first.entry.remote_submission?.status).toBe('uploaded')
    const later = archiveFinalLog({...withBattle('quota'), feedback: {strength: 'Normal'}}, {remote: true, previous: first.entry.remote_submission})
    expect(later.entry.remote_submission?.submission_id).toBe(first.entry.remote_submission?.submission_id)
    expect(later.entry.remote_submission?.revision).toBe(2)
    setItem.mockRestore()
  })
})
