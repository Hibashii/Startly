import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { AssistantRequest, AssistantResponse } from '../shared/schema.js'
import { callAssistant } from './assistant.js'
import { transcribeAudio } from './transcribe.js'

// Routes only, no listen(): server/index.ts runs it locally, api/index.ts exports it for Vercel.
export function createApp(call = callAssistant, transcribe = transcribeAudio) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '200kb' }))

  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30)
  if (limit > 0) {
    // One counter per route: talking then sending is two requests, and voice shouldn't eat the message budget.
    for (const path of ['/api/assistant', '/api/transcribe']) {
      app.use(
        path,
        rateLimit({
          windowMs: 60 * 60 * 1000,
          limit,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          message: { error: 'rate_limited' },
        }),
      )
    }
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

  // The raw recording, as the browser made it (webm, or mp4 on Safari). 4 MB is minutes of speech, under Vercel's 4.5 MB.
  app.post('/api/transcribe', express.raw({ type: 'audio/*', limit: '4mb' }), async (req, res) => {
    const audio = req.body
    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      res.status(400).json({ error: 'bad_request' })
      return
    }
    try {
      res.json({ text: await transcribe(audio, req.get('Content-Type') ?? 'audio/webm') })
    } catch (err) {
      console.error('[transcribe]', (err as Error).message)
      res.status(502).json({ error: 'transcribe_unavailable' })
    }
  })

  // Malformed or oversized JSON → a JSON error, never Express's HTML page.
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status && err.status < 500 ? err.status : 500).json({ error: 'bad_request' })
  })

  return app
}
