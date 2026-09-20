import type {IncomingMessage, ServerResponse} from 'node:http'
import type {BattleApiInput} from '../src/types.ts'
import {replayBattle} from './simulator.ts'

async function readJson(request: IncomingMessage): Promise<BattleApiInput> {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 100_000) throw new Error('request is too large')
  }
  return JSON.parse(body) as BattleApiInput
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  if (request.method !== 'POST') { response.statusCode = 405; response.end(JSON.stringify({error: 'POST required'})); return }
  try {
    response.statusCode = 200; response.end(JSON.stringify(await replayBattle(await readJson(request))))
  } catch (error) {
    response.statusCode = 400; response.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)}))
  }
}
