import { existsSync } from 'node:fs'
import { createApp } from './app.js'

// Local only: load .env if present (on Vercel the env vars come from the dashboard).
if (existsSync('.env')) process.loadEnvFile('.env')

const port = Number(process.env.PORT ?? 3001)
createApp().listen(port, () => {
  console.log(`Startly API on http://localhost:${port}`)
  if (!process.env.OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set: copy .env.example to .env')
})
