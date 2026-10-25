---
doc: spec
status: approved
---

# Startly — Technical Spec

## How This Works, In Plain Language
Startly has three pieces:

1. **The app in the browser** (React + Vite + TypeScript, styled with Tailwind and shadcn/ui). It shows the first screen, the timetable, the chat drawer and the settings. It **saves everything in localStorage**, the browser's own small storage for one site. Reopen the app on the same laptop and browser and your plan is still there. Another browser or computer starts empty.
2. **A tiny Express server** with one route, `POST /api/assistant`. Its only jobs are to **keep the OpenAI key secret** (it reads it from `.env`, which never reaches the browser or GitHub) and to pass your message to OpenAI.
3. **OpenAI (the "brain")** **understands your words** and turns them into a short list of **actions** in a fixed format, like `add task "Gym", 1h` or `"Hackathon" started at 16:00, needs 2h`, plus a friendly reply.

Then the most important rule: **the AI translates, the code decides.** The AI never writes the timetable itself. A plain TypeScript **scheduler** in the browser takes the actions and places the blocks: fixed appointments never move, nothing overlaps, lunch and breaks get added, and anything that doesn't fit goes to a later day with free time. When there's a real tradeoff (the day would end after 23:00, or a task with no deadline doesn't fit), the scheduler **stops and asks you** instead of guessing. Because the scheduler is ordinary code, it gives the same answer every time and can be unit-tested. You don't have to re-read the AI's output to trust the timetable.

Why this shape: it's the smallest setup that keeps the key safe and makes the timetable reliable. No database and no accounts. It's built locally first, and made **deploy-ready** so it can go on Vercel at the end with a free `*.vercel.app` link.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **First open.** `App` loads the saved state from localStorage. There are no tasks, so it shows `FirstScreen`.
2. **The dump.** You type and press **Plan my day →**. The browser sends `{ message, context }` to `POST /api/assistant`. `context` holds the current time and date, your tasks, free time, end-of-day time and the last few chat messages.
3. **The AI translates.** The server calls OpenAI with **structured outputs** (the reply must match a schema) and returns `{ reply, actions[] }`, for example `add_task ×4`, `add_fixed "Interview" Wed 11:30–12:00`.
4. **The code schedules.** `applyActions` updates the task list, then `schedule` places today from *now* until the end of the day: fixed blocks first, then tasks by deadline → priority → order, plus lunch and breaks. Tasks that don't fit and have a later deadline go to the next day with free time. A task that has no deadline, or a day that would run too late, becomes a **question** instead.
5. **You see the plan.** The store saves to localStorage and the `MainScreen` appears. The chat shows the AI's reply plus a code-written summary ("Moved 'Job application #3' to Sunday, since it's due Monday").
6. **During the day.** `now()` (browser time) decides which block gets the **Now** card. Checking a box marks the task `done` and shows a toast. When the last task of the day is checked → confetti and a celebration.
7. **Something changes.** Either a **quick button** on the Now card (handled directly by code, no AI call) or a chat message (AI → actions) → `reshuffle` re-places everything after now → a toast ("↻ Reshuffled 3 tasks") plus a chat line listing what moved. If the result would end after 23:00 → the scheduler keeps it as a **pending proposal** and the chat asks, with buttons. Nothing changes until you answer.
8. **Coming back.** Reopen → the state loads from localStorage → the same plan. If it's a new day, the chat is cleared and Startly says good morning (and asks about yesterday's unchecked tasks).

## Stack
| Piece | Choice | Docs |
|---|---|---|
| Language | TypeScript everywhere (browser + server) | https://www.typescriptlang.org/docs/ |
| Front-end | React + Vite | https://react.dev · https://vite.dev/guide/ |
| Styling | Tailwind CSS v4 + **shadcn/ui** (Button, Input, Textarea, Checkbox, Sheet/drawer, Dropdown/Popover, Dialog, Switch, ToggleGroup, Sonner toasts) | https://tailwindcss.com/docs · https://ui.shadcn.com/docs/installation/vite |
| App state + saving | **Zustand** with its `persist` middleware → localStorage | https://zustand.docs.pmnd.rs/integrations/persisting-store-data |
| Dates | date-fns (add days, weekdays, formatting) | https://date-fns.org/docs |
| Confetti | canvas-confetti | https://github.com/catdad/canvas-confetti |
| Server | Express 5 + `tsx` (runs TypeScript directly) | https://expressjs.com/ · https://tsx.is/ |
| AI | OpenAI API via the official `openai` Node SDK, **Responses API + structured outputs** with a Zod schema | https://platform.openai.com/docs/guides/structured-outputs · https://github.com/openai/openai-node |
| Validation | Zod (one schema shared by the server and the browser) | https://zod.dev |
| Tests | Vitest (scheduler unit tests) | https://vitest.dev |
| Dev runner | `concurrently` (runs Vite + server with one command) | https://github.com/open-cli-tools/concurrently |
| Rate limit | `express-rate-limit` (30 messages / hour / visitor on `/api/assistant`) | https://express-rate-limit.mintlify.app/ |
| Browser tests | Playwright (through the Playwright MCP during the build) | https://playwright.dev |
| Hosting (end of build) | Vercel, free Hobby plan, free `*.vercel.app` URL | https://vercel.com/docs/frameworks/backend/express |

Rationale (your choices):
- **Vite + React + TypeScript + Express:** you already use Vite and React at work. Next.js would mean learning a new framework in the middle of the hackathon. Accepted tradeoff: two processes instead of one, started with a single `npm run dev`.
- **OpenAI with your own API key**, kept on the server.
- **localStorage, no database:** one person, one browser, no accounts. A database comes later, once there are accounts.
- **The AI translates, the code schedules** (option B): reliable, testable times. Accepted tradeoff: more code to write (the scheduler).

Implementation details I picked from those choices (you can veto them): Zustand rather than a hand-written context + reducer (`persist` handles saving for free); a shared Zod schema so the server and the browser agree on the action format; Vitest for the scheduler.

**Model: GPT-6 Luna** (released Sept 22, 2026, the cheapest GPT-6 tier). It's about $0.10 per million input tokens and $0.50 per million output tokens, versus $0.75 / $4.50 for GPT-5.4 mini, so it's roughly 7–9× cheaper, and newer. Startly's AI job (turning sentences into a fixed list of actions) is simple, so the cheapest current model is enough. Set by `OPENAI_MODEL` in `.env`, default `gpt-6-luna`. **Fallback:** `gpt-5.4-mini`, if Luna misbehaves with structured outputs. Sources: https://developers.openai.com/api/docs/pricing · https://developers.openai.com/api/docs/models/gpt-5.4-mini · https://venturebeat.com/technology/openai-releases-gpt-6-sol-and-luna-models-slashing-api-costs-50-or-more

**To verify in the first build step:** the exact API model id for Luna (`gpt-6-luna` is assumed) and that it supports structured outputs. If either is wrong, use `gpt-5.4-mini`. Also check that the SDK's `responses.parse` + `zodTextFormat` works as documented, the current shadcn + Tailwind v4 + Vite setup, and Vercel's current Express support.

## Where It Runs and How Someone Tries It
- **Runs locally:** Node 20+ on your laptop, opened in the browser on a laptop.
- **Setup:** `npm install`, then copy `.env.example` → `.env` and set `OPENAI_API_KEY=` (and optionally `OPENAI_MODEL=`). `.env` is already in `.gitignore`. Agents never read it.
- **Start:** `npm run dev` → Vite on http://localhost:5173 (it forwards `/api/*` to Express on http://localhost:3001). Open **http://localhost:5173**.
- **Tests:** `npm test` runs the scheduler tests.
- **Reset to a fresh first screen:** ⋯ menu → **Start fresh…** (asks first; keeps your color and mode). The chat alone can be cleared from its header.
- **Submission:** a short **demo video** of the local app plus a **public GitHub repo**. Both are required.
- **Deployment: Vercel, at the end** (once the app works locally, in `6-ship` or as the last build step). You chose it to share a link and to learn how Vercel works.
  - **Deploy-ready from day one:** the Express app lives in `server/app.ts` (routes only, no `listen`). `server/index.ts` starts it locally on :3001, and `api/index.ts` exports the same app for Vercel. Vite builds the front-end to `dist/`, which Vercel serves statically.
  - **Steps (at deploy time):** push to GitHub → import the repo at vercel.com (free Hobby plan) → add `OPENAI_API_KEY` and `OPENAI_MODEL` under Project → Settings → Environment Variables → deploy → you get `https://startly-….vercel.app`. No domain to buy.
  - **Protecting your credit:** a public link is only "secret" until it's shared (and the Devpost page is public), so don't rely on nobody guessing it. The protections are (1) the **30 messages / hour / visitor** rate limit, set by `RATE_LIMIT_PER_HOUR` (raise or remove it with an env var, no code change), (2) a **monthly budget limit** in the OpenAI dashboard (e.g. $10), and (3) **auto-recharge off**. Note: on Vercel the in-memory rate limit is per server instance, so it's a speed bump, not a wall. Good enough for a PoC.
  - Each visitor's plan stays in **their own** browser (localStorage), so nobody sees anyone else's tasks.
- **Demo clock (added at demo time, not now):** for recording, add a dev-only `?now=16:00` URL override inside `now()` so the demo story works whatever the real time is. Until then the app uses the real browser time.

## Look and Feel
Carried forward from `prd.md > Look and Feel`. The visual reference is **`devpost/startly-design.html`**: copy its tokens and component shapes rather than redesigning. Its 🎨 button is replaced by the ⋯ menu.

- **Font:** SF Pro through the system stack: `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`.
- **Light mode:** background **pure `#ffffff`**, neutral grays only (no cream or off-white). **Dark mode:** background `#161512`, cards `#201f1b` / `#2b2924`.
- **Theme tokens:** CSS variables on `:root`, switched by `<html data-theme="light|dark" data-accent="iris|ocean|sage|plum|coral|ink">`. Each accent defines `--accent`, `--accent-soft` (tints) and `--accent-strong`, with a lighter version under dark mode. shadcn's `--primary` / `--ring` map to `--accent`, so buttons and checkboxes follow it automatically.
- **Main screen:** layout I cards (filled rounded blocks; dashed outlines for lunch and breaks; done tasks faded and crossed out). The Now card is tinted, with an accent bar on the left and an uppercase **NOW · 1H40 LEFT** tag. Quick buttons are pills, the toast is a dark pill, and the chat is ChatGPT-style (Startly is plain text next to its avatar, yours are tinted bubbles, with a rounded input and a round send button).
- **First screen:** the hook in two tones, with an accent highlighter under "Start here." that draws itself (a CSS animation on a `background-size` or SVG stroke), the 1 → 2 → 3 steps in neutral gray circles, and the big rounded multi-line input with **Plan my day →** at the bottom right.
- **Avatar:** an inline SVG React component (the glossy Boss). The body gradient uses accent variables. Eyes, headset and bow tie stay `#1b1b1f`.
- **Avoid:** loud state colors, a top progress bar, too much text, several eye-catching things on one screen. Don't use the `frontend-design` skill.

## Components

### App Shell and Screen Switch
`App.tsx` loads the store, runs the **morning reset** (see *Daily Chat Reset*), and shows `FirstScreen` if there are no tasks, otherwise `MainScreen`. It sets `data-theme` and `data-accent` on `<html>`.
PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`.

### Top Bar
Avatar + "Startly" on the left. In the center (main screen only), **today's date**: click it to toggle the Week Strip. On the right, the ⋯ Settings Menu and the **Ask Startly** pill, which toggles the chat drawer and is tinted when it's open.
PRD ref: `prd.md > Main Screen`.

### First Screen
The hook, the steps line and the big input. On submit it calls the Assistant Client, then the screen switches once tasks exist. If the AI found nothing to plan (an unclear dump), the main screen opens with an empty "Nothing planned yet" timetable and the chat open on Startly's follow-up question.
PRD ref: `prd.md > First-Time Screen`, `prd.md > States and Boundaries` (unclear dump).

### Week Strip
Hidden by default. A rolling 7 days starting **today**. Each day shows its planned total ("2h30") and 📌 if it has a fixed appointment. Clicking a day sets `selectedDate`, and the timetable shows that day. No past days.
PRD ref: `prd.md > Main Screen`, `prd.md > States and Boundaries`.

### Timetable
Header: "Today" (or the weekday), a summary ("6h planned · until 21:15") and a **List / Grid** toggle (List by default).
- **List view:** cards in time order.
- **Grid view:** an hour grid (like a calendar day view), blocks positioned by minute, and a line at `now()`.
- **Task card:** checkbox, a name you can click to rename (Enter saves → "✓ Renamed" toast), the time range. Lunch and breaks are dashed and have no checkbox.
PRD ref: `prd.md > Main Screen`, `prd.md > Editing Tasks Directly`, `prd.md > Checking Off and Rewards`.

### Now Card and Quick Buttons
The single block where `start ≤ now < end` gets the Now style and "● Now · [time left]". Quick buttons on hover (handled by code, **no AI call**):
- **Need more time** → +30 min to the task, then reshuffle.
- **Not started** → the task starts at `now` with its full duration, then reshuffle.
- **→ Tomorrow** → move it to tomorrow.

**"Did you finish…?"**: if the most recent task whose end time has passed is still unchecked and nothing new has started, the Now style stays on it and asks **"Did you finish [task]?"** with **✓ Done / Need more time / Skip to tomorrow**. Ignoring it changes nothing.
Each action shows a toast and adds a short line in the chat listing what moved.
PRD ref: `prd.md > The Now Task and Unfinished Tasks`, `prd.md > Reshuffling When the Day Changes`.

### Chat Drawer
A right-side drawer (~40% width, shadcn Sheet without the dimming overlay, or a custom sliding panel). It holds the messages (Startly's with the avatar), a typing indicator during the request, and the input. Startly's messages can carry **option buttons** (the tradeoff questions and the morning question). Pressing one either applies a pending proposal or sends that answer.
PRD ref: `prd.md > The Assistant Chat`.

### Assistant Server Route
`server/app.ts`: Express, `POST /api/assistant`, behind a 30/hour/visitor rate limit. It validates the body with Zod, builds the prompt (`server/prompt.ts`) and calls OpenAI with `responses.parse` and the shared `AssistantResponse` schema. It returns `{ reply, actions }` or `{ error }`. The key comes from `process.env.OPENAI_API_KEY` (loaded with `dotenv` or `node --env-file`).
The **system prompt** tells the model: you are Startly, a calm personal assistant. Only output actions from the schema. Use task ids from the context. Never invent times for tasks (that's the scheduler's job); only fixed appointments have exact times. Ask a follow-up (no actions) when the dump is unclear. Add a short discipline nudge with a quote only when it fits, and respect rest. Not a general chatbot.
PRD ref: `prd.md > Planning the Day`, `prd.md > The Assistant Chat`, `prd.md > Non-Goals`.

### Assistant Client
`src/lib/api.ts`: `askStartly(message)` builds the `context` from the store, posts it and returns `{ reply, actions }`. Then `applyActions` → scheduler → store. This is the only place the browser talks to the server.

### Scheduler (the core)
Pure TypeScript functions with no React and no network. Unit-tested.
- `scheduleDay(date, tasks, availability, settings, fromTime)` → blocks for that day. Rules:
  1. Fixed appointments are placed at their exact times and never move.
  2. Done tasks and the task in progress keep their times.
  3. The remaining tasks are placed in order: **deadline (soonest first) → priority (high → low) → existing order**, from `max(fromTime, window start)` rounded up to 5 min, filling gaps around fixed blocks. A task with `preferredStart` ("put the gym in the morning" → e.g. 08:00) is placed at or after that time.
  4. **Lunch:** 45 min, inserted at the first task boundary at or after 12:30 if the day's window covers 12:00–14:00. **Breaks:** 15 min after every ~90 min of back-to-back tasks.
  5. A task that doesn't fit before the end of the window → **overflow**.
- **Overflow handling:** a task with a later deadline → the next day (up to its deadline) that has enough free time, and it's recorded as "moved to [day] because [deadline]". A task with no deadline, or due today → a **conflict**.
- **Day window:** today = `now` → `endOfDay` (default **23:00**). Other days = the free time you gave for them (`availability`). If a day's free time is unknown → a conflict that makes Startly ask "When are you free on Sunday?"
- `reshuffle(state)` = re-run `scheduleDay` for today from `now()`, then overflow handling.
- Returns `{ newState, moved[], conflicts[] }`. `diff.ts` turns `moved` into the toast count and the chat summary text (written by code, so it's always accurate).
PRD ref: `prd.md > Planning the Day`, `prd.md > Reshuffling When the Day Changes`.

### Tradeoff Questions and Pending Proposals
When the scheduler returns conflicts, the store does **not** apply the new plan. It saves `pending = { proposal, question, options }` and the chat shows the question with buttons, written by code templates:
- Day too late → "That puts you until 23:40. OK, or should I move '[lowest-priority task]' to tomorrow?" → **Keep it / Move it**.
- No deadline, doesn't fit → "'[task]' doesn't fit today. Tomorrow, or drop it?" → **Tomorrow / Drop it**.
- Unknown free time → a plain question. You answer in text and the AI returns `set_availability`.
Pressing a button resolves `pending` and applies the chosen version. A new chat message while something is pending sends `pending` in the context, so the AI can answer it in words ("ok keep it" → `resolve_pending`).
PRD ref: `prd.md > Reshuffling When the Day Changes`, `prd.md > Planning the Day`.

### Check-off, Encouragement and Celebration
Checking → `status: done` + a toast with a random line from `lib/messages.ts` ("Nice! One down 🎉"). Unchecking undoes it. When every task (not lunch or breaks) of today is done and `lastCelebratedDate ≠ today` → `canvas-confetti` + a Dialog with a random message and quote and a **Rest well** button. Then `lastCelebratedDate = today` and the timetable shows the calm, finished day.
PRD ref: `prd.md > Checking Off and Rewards`, `prd.md > States and Boundaries`.

### Settings Menu
A ⋯ Popover with 6 swatches (Iris default, Ocean, Sage, Plum, Coral, Ink) and a Light/Dark Switch. It closes on an outside click. Stored in the store's `settings`, so it persists. The first visit uses `prefers-color-scheme` until you switch.
PRD ref: `prd.md > The Settings Menu`.

### Daily Chat Reset
On app load (and when the tab gets focus again), if `chat.date ≠ today`, the chat is cleared and a **Good morning** greeting is added (code template, picked from a few variants, no AI call). If tasks from earlier days are unchecked, the greeting lists them with **Add both / Choose / Drop them**. *Choose* shows a checkbox per task in the message. The plan is kept, and today's blocks are re-placed from its availability.
PRD ref: `prd.md > The Assistant Chat`, `prd.md > States and Boundaries`.

### Languages (i18n)
`src/i18n/`: one dictionary per language (`en.ts` is the source of truth; `fr/es/de/nl/ar.ts` are typed `Dict`, so a missing or mismatched message is a build error). Logic code (scheduler, store) returns language-free `Text` = `{ k: messageKey, p: params }` via `msg()`; only the UI turns it into words (`useT()` / `translate()`), so a language switch re-renders the chat history too. `format.ts` uses `Intl` for weekdays, dates, lists, quotes and durations (Latin digits in Arabic). `<html lang dir>` is set from `settings.lang`; layout uses logical start/end classes so Arabic mirrors; time ranges are isolated left-to-right. The AI receives `context.language` and replies in the user's language. Message keys are saved in chats, so renaming one needs a store migration (store v1 → v2 cleared the old chat).

## Data Model
Everything lives in **one Zustand store, saved to localStorage** under the key `startly-v1` (with a version number so the format can change later). Times are **local**: dates as `"YYYY-MM-DD"`, times as `"HH:MM"`.

```ts
type Priority = 'high' | 'medium' | 'low'

interface Task {
  id: string               // short, e.g. "t7", so the AI can refer to it
  title: string
  kind: 'task' | 'fixed'   // fixed = appointment with exact time
  durationMin: number
  priority: Priority
  deadline: string | null  // "YYYY-MM-DD"
  preferredStart: string | null // "HH:MM", from "put gym in the morning"
  endBy?: string | null     // "HH:MM", must be finished by ("the shop closes at 20:00")
  partOf?: string           // on "X (cont.)": the rest of task X after a split
  date: string | null      // day it's scheduled on (null = unplaced)
  start: string | null     // "HH:MM", set by the scheduler (or fixed)
  status: 'todo' | 'done'
  order: number            // stable tiebreak
}

interface Block {          // what the timetable renders, derived by the scheduler
  date: string; start: string; end: string
  type: 'task' | 'fixed' | 'lunch' | 'break'
  taskId?: string
}

interface AppState {
  tasks: Task[]
  blocks: Record<string, Block[]>          // by date
  availability: Record<string, { start: string; end: string }[]> // by date or "mon".."sun"
  settings: { lang: Lang; accent: Accent; theme: 'light' | 'dark' | null; endOfDay: string /* "23:00"; past midnight = "25:00" */; breaks?: { afterMin; lengthMin } }
  chat: { date: string; messages: ChatMessage[] }
  pending: { proposal: Partial<AppState>; question: string; options: Option[] } | null
  lastCelebratedDate: string | null
  ui: { selectedDate: string; view: 'list' | 'grid'; chatOpen: boolean; weekOpen: boolean } // not persisted
}
```

| Data | Where | How it changes | When you come back |
|---|---|---|---|
| Tasks + blocks | localStorage | scheduler after AI actions, quick buttons, check, rename | the same plan |
| Availability, end of day | localStorage | AI actions (`set_availability`, `set_end_of_day`) | remembered |
| Accent, theme | localStorage | ⋯ menu | remembered |
| Chat messages | localStorage | sending, replies, code summaries | cleared if it's a new day |
| Pending question | localStorage | a conflict sets it; answering clears it | still asked |
| View, open drawer, week strip | memory only | clicks | back to defaults |

### The AI Action Format
Defined once in `shared/schema.ts` (Zod) and used by both sides. Structured outputs need every field present, so "optional" fields are `nullable`.

```ts
AssistantResponse = { reply: string, actions: Action[] }
Action =
  | { type: 'add_task', title, durationMin, priority, deadline|null, preferredStart|null, endBy|null, date|null }
  | { type: 'add_fixed', title, date, start, end }
  | { type: 'update_task', id, title|null, durationMin|null, priority|null, deadline|null, preferredStart|null, endBy|null }
  | { type: 'remove_task', id }
  | { type: 'started_at', id, start, remainingMin|null }   // "I only started X at 16:00, it needs 2h"
  | { type: 'extend_task', id, extraMin }                  // "I need more time"
  | { type: 'move_to_day', id, date }
  | { type: 'set_availability', key /* date or weekday */, windows: {start,end}[] }
  | { type: 'set_end_of_day', time }
  | { type: 'plan_days', dates: string[] }                 // "plan my weekend", "plan tomorrow"
  | { type: 'resolve_pending', optionId }
```
Context sent with each message: `{ now: "2026-10-17T16:05", weekday, today, tasks (id, title, date, start, duration, status, deadline, priority, onTimetable), timetable (today's blocks as placed, breaks included), breaks, availability, endOfDay, pending, recentMessages (last 10) }`. The AI also returns `order` (its suggested order of the day) and can send `set_breaks`.

## File Structure
```
devpost-hackathon/
├── index.html
├── package.json              # scripts: dev (concurrently vite + tsx watch server), build, test
├── vite.config.ts            # React plugin, Tailwind, proxy /api → http://localhost:3001
├── tsconfig.json             # (+ tsconfig.app.json / tsconfig.node.json from Vite)
├── components.json           # shadcn/ui config
├── .env.example              # OPENAI_API_KEY=  OPENAI_MODEL=gpt-6-luna  RATE_LIMIT_PER_HOUR=30
├── .env                      # your key — gitignored, never read by agents
├── shared/
│   └── schema.ts             # Zod: Action, AssistantResponse, AssistantRequest (used by both sides)
├── vercel.json               # (only if needed) rewrites /api/* → api/index.ts
├── api/
│   └── index.ts              # Vercel entry: export default app (from server/app.ts)
├── server/
│   ├── app.ts                # Express app: JSON, rate limit, POST /api/assistant (no listen)
│   ├── index.ts              # local start: app.listen(3001)
│   ├── assistant.ts          # OpenAI call (responses.parse + zodTextFormat)
│   ├── prompt.ts             # Startly system prompt + context formatting
│   └── app.test.ts           # route tests with mocked OpenAI (supertest)
├── src/
│   ├── main.tsx
│   ├── App.tsx               # screen switch, morning reset, theme attributes
│   ├── index.css             # Tailwind + theme tokens (accents × light/dark)
│   ├── types.ts              # Task, Block, AppState, ChatMessage…
│   ├── state/
│   │   └── store.ts          # Zustand store + persist, actions (send, check, rename, quick buttons, resolve)
│   ├── scheduler/
│   │   ├── schedule.ts       # scheduleDay, reshuffle, overflow, lunch & breaks
│   │   ├── applyActions.ts   # AI actions → task changes → scheduler → {state, moved, conflicts}
│   │   ├── questions.ts      # conflicts → question text + option buttons
│   │   ├── diff.ts           # moved → toast count + chat summary
│   │   └── schedule.test.ts  # Vitest: overlaps, fixed stays, lunch/breaks, overflow, late → conflict
│   ├── lib/
│   │   ├── time.ts           # now() (browser time; demo override added later), HH:MM ↔ minutes, date keys
│   │   ├── api.ts            # askStartly()
│   │   └── messages.ts       # encouragement, celebration, morning greetings, quotes
│   └── components/
│       ├── ui/               # shadcn-generated components
│       ├── Avatar.tsx        # glossy Boss SVG, accent-colored body
│       ├── TopBar.tsx
│       ├── SettingsMenu.tsx
│       ├── FirstScreen.tsx
│       ├── MainScreen.tsx    # layout: week strip + timetable + chat drawer
│       ├── WeekStrip.tsx
│       ├── timetable/
│       │   ├── TimetableHeader.tsx
│       │   ├── ListView.tsx
│       │   ├── GridView.tsx
│       │   ├── TaskCard.tsx  # checkbox, inline rename
│       │   └── NowCard.tsx   # Now tag, quick buttons, "Did you finish…?"
│       ├── chat/
│       │   ├── ChatDrawer.tsx
│       │   ├── ChatMessage.tsx  # avatar, bubbles, option buttons, Choose checkboxes
│       │   └── ChatInput.tsx
│       └── Celebration.tsx   # confetti + dialog
├── devpost/                  # Devpost learning workspace (planning docs)
└── README.md
```

## External Services and Dependencies

### OpenAI API
- **Call:** `client.responses.parse({ model: process.env.OPENAI_MODEL, instructions: SYSTEM_PROMPT, input: [{ role: 'user', content: JSON.stringify({ context, message }) }], text: { format: zodTextFormat(AssistantResponse, 'startly') } })` → `response.output_parsed` is `{ reply, actions }`.
- **Auth:** `OPENAI_API_KEY` in `.env`, read only by the server.
- **Cost:** one message is roughly 3k tokens in and 300 out ≈ **$0.0005 with Luna** (≈ $0.004 with GPT-5.4 mini). A whole hackathon of testing costs cents.
- **Docs:** https://platform.openai.com/docs/guides/structured-outputs · https://platform.openai.com/docs/api-reference/responses · https://github.com/openai/openai-node
- **Rate limits:** the default tier is far above one person's chat use.

### Our Own Route
`POST /api/assistant`
Request: `{ message: string, context: Context }`
Response 200: `{ reply: string, actions: Action[] }`; 429: `{ error: "rate_limited" }`; 502: `{ error: "assistant_unavailable" }`.

### Vercel
Free Hobby plan. Static `dist/` + one function (`api/index.ts`) wrapping the Express app. Env vars set in the Vercel dashboard. Docs: https://vercel.com/docs/frameworks/backend/express · https://vercel.com/docs/environment-variables. No database.

## Important Failure Modes
- **OpenAI is slow or down, or the key is missing** → a typing indicator while waiting (with a 30 s timeout), then a Startly message: "I couldn't reach my brain just now. Try again?" with a **Retry** button. The plan isn't touched.
- **The AI returns a bad action** (unknown task id, impossible time) → Zod plus `applyActions` skip that action and apply the valid ones. If nothing valid is left, Startly says it didn't understand and asks again.
- **The day can't fit** → never fail silently. The scheduler returns a conflict and Startly asks (see *Tradeoff Questions*).
- **Rate limit hit** (429) → Startly says "That's a lot of messages for one hour. Give me a few minutes." The plan isn't touched.
- **Saved data is corrupted or from an old version** → the store's `persist` version check falls back to a fresh state (first screen) instead of a crash.

## What Was Simplified and Why
- **localStorage** instead of a database and accounts: one person, one browser, enough to prove a living timetable. The fuller version would need auth, a hosted DB and sync.
- **Your own API key on a local server** instead of "Sign in with ChatGPT" (users spend their own plan): that needs OpenAI's commercial trial plus a login flow. A good "next step" for the Devpost write-up.
- **Simple scheduling rules** (fixed lunch at around 12:30, a 15-min break after about 90 min, sorting by deadline → priority) instead of a smart optimizer or learned habits. They're predictable and easy to test. "Learning the person" is in `prd.md > Possible Later Enhancements`.
- **Quick buttons and the morning greeting are code, with no AI call:** instant, free and reliable. The AI is only used where language needs understanding.
- **Deploy at the end, protected by a rate limit and a budget cap** instead of accounts or captchas. Real protection would need login or per-user keys.
- **Demo clock later:** the real browser time now, and a `?now=` override only when recording.

## Decisions and Open Issues

### Decisions (yours)
- **Stack:** React + Vite + TypeScript + Express. You use Vite and React already, and Next.js is new to you. You asked me to recommend and accepted it.
- **AI provider:** the OpenAI API with your own prepaid key. The key lives in `.env`, which is gitignored, and agents never read it.
- **"The AI translates, the code schedules"** (option B). You agreed: the AI says *what* to schedule, and the code places and reshuffles.
- **The AI suggests the order of the day** (changed during the build, your call): "that's why we added the AI." With each reply it returns `order` (today's tasks first to last), guessing sensible limits itself (shops closing, gym hours) and saying what it assumed. The code still places every block and enforces the hard limits: fixed times, finish-by times, holds, end of day, no overlaps. You correct it in plain words.
- **Storage:** localStorage for the PoC, with a database later once the full app works.
- **Usual end time** (from `prd.md > Open Questions`): **23:00 by default, changeable by telling Startly** ("I stop at 22:00" → `set_end_of_day`). No settings screen for it.
- **Time:** the browser's real time now. The `?now=` demo override is added only when you prepare the demo.

- **Model:** GPT-6 Luna (you asked me to compare it with GPT-5.4 mini. Luna is newer and roughly 7–9× cheaper), with GPT-5.4 mini as the fallback.
- **Deploy:** build locally, deploy-ready from the start, then put it on Vercel when it works. You want to learn how Vercel works. Free `*.vercel.app` URL, no domain.
- **Rate limit:** 30 messages / hour / visitor, changeable with `RATE_LIMIT_PER_HOUR`.

### How the build is verified (your requirement)
- **Scheduler:** Vitest unit tests for every rule (no overlaps, fixed stays, lunch/breaks, overflow by deadline, late → conflict, the started-late demo story).
- **Backend:** route tests with a **mocked OpenAI** (Vitest + supertest), covering validation, 429 and the 502 fallback, at no credit cost. Then a **handful of real calls** (a dump, a "started late", an unclear message) to check that the real model returns valid actions. Keep real calls few: $20 of credit.
- **In the browser:** Playwright drives the real app through the PRD's checkboxes (dump → timetable, reshuffle + toast, check-off + confetti, rename, ⋯ menu colors/mode, reload keeps the plan). Mock the API route where the AI isn't the point, to save credit.

### Implementation details (derived, not separately chosen by you)
Zustand + persist; a shared Zod schema; Vitest for the scheduler; "Need more time" = **+30 min**; lunch 45 min at around 12:30; breaks of 15 min after about 90 min; "put X in the morning" = `preferredStart` 08:00 unless a time is given. All of these are easy to change.

### The useful unknown
**"How does the code know what time it is?"** You weren't sure how the app gets the time, and why an override would be needed. What clarified it: the browser's `new Date()` reads the laptop's clock and time zone, so Startly uses real local time. The override only exists because the demo story ("I started at 16:00") has to work whenever the video is recorded. Routing every time read through one `now()` function makes that a one-line change later.

### Open
- Verify the Luna model id + structured-outputs support (fallback `gpt-5.4-mini`), plus `responses.parse` + `zodTextFormat`, in the first build step.
- Verify Vercel's current Express setup at deploy time.
- Verify the current shadcn/ui + Tailwind v4 + Vite setup steps.
- **Stretch:** full week grid view (`prd.md > Deferred From the POC`). Not planned in the file tree.
