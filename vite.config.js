import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `api/*.js` are Vercel serverless functions. In production Vercel runs them for
// us; in `npm run dev` this plugin mounts the same handlers on the Vite dev
// server so both environments execute identical code.
//
// `analyze` takes json; `speech` takes raw wav bytes, because base64 in a json
// body would cost a third of the 4.5 MB request budget for nothing.
const ROUTES = [
  { path: '/api/analyze', module: '/api/analyze.js', body: 'json' },
  { path: '/api/interview', module: '/api/interview.js', body: 'json' },
  { path: '/api/speech', module: '/api/speech.js', body: 'raw' },
]

function serverlessApi() {
  return {
    name: 'serverless-api-dev',
    configureServer(server) {
      for (const route of ROUTES) {
        server.middlewares.use(route.path, async (req, res) => {
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (payload) => {
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(payload))
            return res
          }

          try {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const raw = Buffer.concat(chunks)

            if (route.body === 'json') {
              const text = raw.toString('utf8')
              req.body = text ? JSON.parse(text) : {}
            } else {
              req.body = raw
            }

            const { default: handler } = await server.ssrLoadModule(route.module)
            await handler(req, res)
          } catch (error) {
            server.config.logger.error(`[${route.path}] ${error.stack || error.message}`)
            if (!res.writableEnded) res.status(500).json({ error: error.message })
          }
        })
      }
    },
  }
}

// Server-side settings the dev-mode handler needs. Vite only surfaces VITE_* to
// the client by design, so these are read explicitly and never bundled.
const SERVER_ENV_KEYS = [
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_REASONING_EFFORT',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'RATE_LIMIT_PER_HOUR',
  'SPEECH_RATE_LIMIT_PER_HOUR',
  'INTERVIEW_RATE_LIMIT_PER_HOUR',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_ENV_KEYS) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), tailwindcss(), serverlessApi()],
  }
})
