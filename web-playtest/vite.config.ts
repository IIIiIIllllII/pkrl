import {defineConfig, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'
import {replayBattle} from './server/simulator.ts'

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

export default defineConfig({plugins: [react(), battleApi()]})
