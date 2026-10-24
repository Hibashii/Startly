# Startly

**Don't know where to start? Start here.** Dump everything you have to do in plain words, get a school-style timetable for today (lunch and breaks included), and tell Startly when the day changes.

The AI translates, the code decides: OpenAI turns your words into a short list of actions, and a plain TypeScript scheduler places every block.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env   # then set OPENAI_API_KEY (used for planning and voice input)
npm run dev            # http://localhost:5173 (API on :3001)
```

## Timer notifications

When you start the focus timer, the browser asks once whether Startly may show notifications. Allow it, and you're told when a Pomodoro round or break ends, or a task's time is up, while you're in another tab or app.

No notification, only the sound? Your computer may be blocking the browser:

- **macOS:** System Settings → Notifications → your browser (e.g. Google Chrome) → turn on *Allow notifications*. Also check that no Focus mode (Do Not Disturb) is on.
- **Windows:** Settings → System → Notifications → turn notifications on for your browser.
- **In the browser:** click the icon left of the address → Notifications → Allow.

## Tests

- `npm test`: scheduler and API route tests (OpenAI mocked)
- `npm run e2e`: browser tests with Playwright (API mocked)
- Reset to the first screen: clear the site's localStorage in DevTools.
