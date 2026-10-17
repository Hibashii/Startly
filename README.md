# Startly

**Don't know where to start? Start here.** Dump everything you have to do in plain words, get a school-style timetable for today (lunch and breaks included), and tell Startly when the day changes.

The AI translates, the code decides: OpenAI turns your words into a short list of actions, and a plain TypeScript scheduler places every block.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env   # then set OPENAI_API_KEY
npm run dev            # http://localhost:5173 (API on :3001)
```

- `npm test`: scheduler and API route tests (OpenAI mocked)
- `npm run e2e`: browser tests with Playwright (API mocked)
- Reset to the first screen: clear the site's localStorage in DevTools.
