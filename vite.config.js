import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `api/analyze.js` is a Vercel serverless function. In production Vercel runs it
// for us; in `npm run dev` this plugin mounts the same handler on the Vite dev
// server so both environments execute identical code.
function serverlessApi() {
  return {
    name: 'serverless-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
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
          const raw = Buffer.concat(chunks).toString('utf8')
          req.body = raw ? JSON.parse(raw) : {}

          const { default: handler } = await server.ssrLoadModule('/api/analyze.js')
          await handler(req, res)
        } catch (error) {
          server.config.logger.error(`[api/analyze] ${error.stack || error.message}`)
          if (!res.writableEnded) res.status(500).json({ error: error.message })
        }
      })
    },
  }
}

// Server-side settings the dev-mode handler needs. Vite only surfaces VITE_* to
// the client by design, so these are read explicitly and never bundled.
const SERVER_ENV_KEYS = [
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_REASONING_EFFORT',
  'RATE_LIMIT_PER_HOUR',
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
