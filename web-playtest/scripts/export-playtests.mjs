#!/usr/bin/env node
/**
 * Download every remote playtest submission for offline analysis.
 *
 *   node --env-file=.env.local scripts/export-playtests.mjs [--out playtests.jsonl]
 *        [--format jsonl|json] [--envelope] [--since 2026-09-27T00:00:00Z] [--policy v1.1-100m]
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. This is a
 * developer tool: nothing in src/ imports it, so it never enters the web bundle.
 *
 * By default each output record is the stored ResearchLog payload, the same shape
 * as the app's local "Download all as JSONL/JSON" exports, so both feed the same
 * analysis. --envelope wraps each payload with its submission columns.
 */
import {writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

const COLUMNS = 'submission_id,revision,battle_id,created_at,received_at,updated_at,policy_id,schema_version,research_log_version,result,turn_count,flagged_turn_count,has_feedback,app_commit,payload'
const PAGE = 500

/**
 * @param {{url?: string, key?: string, since?: string, policy?: string,
 *   fetcher?: (url: string, init?: RequestInit) => Promise<Response>}} options
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function fetchSubmissions({url, key, since, policy, fetcher = fetch}) {
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  const headers = {apikey: key}
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const query = new URLSearchParams({select: COLUMNS, order: 'received_at.asc,id.asc', limit: String(PAGE), offset: String(offset)})
    if (since) query.append('received_at', `gte.${since}`)
    if (policy) query.append('policy_id', `eq.${policy}`)
    const response = await fetcher(`${url.replace(/\/+$/, '')}/rest/v1/playtest_submissions?${query}`, {headers})
    if (!response.ok) throw new Error(`Supabase responded ${response.status}: ${(await response.text()).slice(0, 300)}`)
    const page = await response.json()
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {{format?: string, envelope?: boolean}} [options]
 */
export function formatSubmissions(rows, {format = 'jsonl', envelope = false} = {}) {
  const records = rows.map(row => {
    if (!envelope) return row.payload
    const {payload, ...submission} = row
    return {submission, payload}
  })
  if (format === 'json') return JSON.stringify({exported_at: new Date().toISOString(), battles: records}, null, 2) + '\n'
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '')
}

function parseArgs(argv) {
  const options = {out: 'playtests.jsonl', format: 'jsonl', envelope: false}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--envelope') options.envelope = true
    else if (['--out', '--format', '--since', '--policy'].includes(arg)) options[arg.slice(2)] = argv[++index]
    else throw new Error(`unknown argument ${arg}`)
  }
  if (!['jsonl', 'json'].includes(options.format)) throw new Error('--format must be jsonl or json')
  return options
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const rows = await fetchSubmissions({url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, since: options.since, policy: options.policy})
    const text = formatSubmissions(rows, options)
    if (options.out === '-') process.stdout.write(text)
    else { writeFileSync(options.out, text); console.error(`wrote ${rows.length} submissions to ${options.out}`) }
  } catch (problem) {
    console.error(problem instanceof Error ? problem.message : problem)
    process.exit(1)
  }
}
