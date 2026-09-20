import type {BattleApiInput} from '../src/types.ts'
import {replayBattle} from './_simulator.ts'

const headers = {'cache-control': 'no-store'}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return Response.json({error: 'POST required'}, {status: 405, headers})
    try {
      const body = await request.text()
      if (body.length > 100_000) throw new Error('request is too large')
      return Response.json(await replayBattle(JSON.parse(body) as BattleApiInput), {headers})
    } catch (error) {
      return Response.json({error: error instanceof Error ? error.message : String(error)}, {status: 400, headers})
    }
  },
}
