import collector from '../server-dist/playtest.cjs'

// Credentials come only from server-side environment variables (see README).
const handler = collector.createPlaytestHandlerFromEnv(process.env)

export default {
  fetch(request) { return handler(request) },
}
