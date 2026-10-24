import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { AssistantRequest, AssistantResponse } from '../shared/schema.js'
import { callAssistant } from './assistant.js'

// Routes only, no listen(): server/index.ts runs it locally, api/index.ts exports it for Vercel.
export function createApp(call = callAssistant) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '200kb' }))

  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30)
  if (limit > 0) {
    app.use(
      '/api/assistant',
      rateLimit({
        windowMs: 60 * 60 * 1000,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'rate_limited' },
      }),
    )
  }

  app.post('/api/assistant', async (req, res) => {
    const parsed = AssistantRequest.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'bad_request' })
      return
    }
    try {
      const out = AssistantResponse.parse(await call(parsed.data.message, parsed.data.context))
      res.json(out)
    } catch (err) {
      console.error('[assistant]', (err as Error).message)
      res.status(502).json({ error: 'assistant_unavailable' })
    }
  })

  // Malformed or oversized JSON → a JSON error, never Express's HTML page.
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status && err.status < 500 ? err.status : 500).json({ error: 'bad_request' })
  })

  return app
}
