import {defineConfig, loadEnv, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'
import {replayBattle} from './server/simulator'
import {createPlaytestHandlerFromEnv, memoryStore} from './server/playtest'

function battleApi(): Plugin {
  return {name: 'local-battle-api', configureServer(server) {
    server.middlewares.use('/api/battle', (request, response) => {
      if (request.method !== 'POST') { response.statusCode = 405; response.end('POST required'); return }
      let body = ''
      request.on('data', chunk => { body += chunk })
      request.on('end', async () => {
        response.setHeader('content-type', 'application/json; charset=utf-8')
        try { response.end(JSON.stringify(await replayBattle(JSON.parse(body)))) }
        catch (error) { response.statusCode = 400; response.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)})) }
      })
    })
  }}
}

/**
 * Local `/api/playtest`, sharing the Vercel function's handler. Server-only
 * variables (no VITE_ prefix) are read from .env.local here and never reach the
 * client bundle. Without Supabase credentials an in-memory store is used.
 */
function playtestApi(env: Record<string, string>): Plugin {
  return {name: 'local-playtest-api', configureServer(server) {
    const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
    if (!configured) server.config.logger.info('[playtest] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set: /api/playtest uses an in-memory dev store')
    const handler = createPlaytestHandlerFromEnv(env, memoryStore())
    server.middlewares.use('/api/playtest', async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(chunk as Buffer)
      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(name, value)
      const result = await handler(new Request(`http://${request.headers.host || 'localhost'}/api/playtest`, {
        method: request.method, headers, body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
      }))
      response.statusCode = result.status
      result.headers.forEach((value, name) => response.setHeader(name, value))
      response.end(await result.text())
    })
  }}
}

export default defineConfig(({mode}) => ({plugins: [react(), battleApi(), playtestApi(loadEnv(mode, process.cwd(), ''))]}))
