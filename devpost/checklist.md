---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast — the learner asked to be shown each checkpoint only after tests, browser checks and review pass. Before every commit, show exactly what is staged; never commit Playwright screenshots or tooling clutter.

## Slices

- [x] **1. Dump your day, get today's timetable (and it's still there on reload)**
  Becomes usable: Open the app → the first screen (hook, 1-2-3 steps, big input) → type a plain-language dump with a fixed appointment → **Plan my day →** → the main screen shows today's timetable as list cards, with lunch and a break you didn't type, and the appointment at its exact time. Reload the page and the plan is still there.
  Why now: It covers the two biggest risks at once: the unfamiliar AI model (does the Luna id exist, and do `responses.parse` + `zodTextFormat` return valid actions?) and the scheduler, which is the "code decides" half of the architecture. Bootstrapping (Vite, Tailwind v4, shadcn, Express, Vitest, the deploy-ready `server/app.ts` / `api/index.ts` split) is folded in here, and so is the look: tokens copied from `startly-design.html`, pure white light mode, SF Pro.
  PRD ref: `prd.md > The Core Journey` (steps 1–3, 7), `prd.md > Planning the Day` (first two criteria), `prd.md > First-Time Screen`, `prd.md > States and Boundaries` (unclear dump, persistence)
  Spec ref: `spec.md > Stack`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Look and Feel`, `spec.md > Components` (App Shell, First Screen, Timetable list view, Assistant Server Route, Assistant Client, Scheduler: `scheduleDay` rules 1–4), `spec.md > Data Model`, `spec.md > The AI Action Format`, `spec.md > File Structure`, `spec.md > External Services and Dependencies`
  Build: Scaffold per the file structure; `npm run dev` runs Vite + Express via `concurrently`; `.env.example`. Write the shared Zod schema (full action union), the server route with rate limit and system prompt, and the OpenAI call (try `gpt-6-luna`, fall back to `gpt-5.4-mini` if needed). Add the Zustand store with `persist` (`startly-v1`), `time.ts` with `now()`, `applyActions` for `add_task`/`add_fixed`, and `scheduleDay` (fixed blocks, deadline → priority → order, lunch, breaks). Then the Avatar, the Top Bar (name + avatar), the First Screen and the Main Screen with header summary + list cards.
  Verify (mechanical): `npm test` passes the scheduler tests (no overlaps, fixed stays put, lunch + break inserted, ordering) and the route tests with mocked OpenAI (valid body → 200, bad body → 400, OpenAI error → 502). `npm run build` succeeds. With your key in `.env`, one real call to `/api/assistant` with a dump returns schema-valid actions (record which model id worked). Playwright: fresh localStorage → first screen → submit a dump (API mocked) → timetable shows fixed time, lunch and a break → reload → same plan.
  Learner check: Run `npm run dev`, open http://localhost:5173, type your real day the way you'd tell ChatGPT (include one appointment with a time), press **Plan my day →**. You should see an hour-by-hour list with lunch and a break you didn't ask for, and the appointment exactly where you said. Reload: it's still there.
  Commit: `Dump to timetable: scaffold, AI actions, scheduler, first + main screen`

- [x] **2. Talk to it and the day reshuffles (the kernel)**
  Becomes usable: The **Ask Startly** pill opens the chat drawer on the right. Tell it "I only started the hackathon at 16:00, it needs 2h", "add: call the bank, 30 min", "delete groceries" or "put the gym in the morning", and the rest of the day re-places itself with no overlaps. A dark pill toast says "↻ Reshuffled 3 tasks" and the chat lists exactly what moved. When OpenAI fails or rate-limits, Startly says so with a Retry, and the plan is untouched.
  Why now: This is the unique kernel, "a living timetable you change by talking to it", so it lands right after there's a timetable to change. Everything after this builds on `reshuffle` and the chat.
  PRD ref: `prd.md > The Core Journey` (step 5), `prd.md > Reshuffling When the Day Changes` (criteria 1, 2, 4), `prd.md > The Assistant Chat` (full conversation, avatar)
  Spec ref: `spec.md > Components` (Chat Drawer, Scheduler: `reshuffle`, `diff.ts`, Assistant Client), `spec.md > The AI Action Format` (`update_task`, `remove_task`, `started_at`, `extend_task`), `spec.md > Important Failure Modes`
  Build: Add `reshuffle` + `diff.ts` (moved list → toast count + chat summary); `applyActions` for update/remove/started_at/extend (bad ids skipped); the store's `send` action; ChatDrawer / ChatMessage / ChatInput with typing indicator, 30 s timeout, Retry and the 429 message; the Ask Startly pill; the Sonner toast styled as a dark pill; recentMessages in the context.
  Verify (mechanical): Vitest: the demo story ("started at 16:00, needs 2h" → every later task moves, no overlaps, fixed blocks unchanged), remove closes the gap, an unknown id is skipped. A real call: "I only started X at 16:00, it needs 2 hours" returns a `started_at` with the right task id. Playwright (API mocked): send a message → blocks move, toast appears then disappears, the chat lists the moves; a mocked 502 → error message + Retry, plan unchanged.
  Learner check: With your plan from slice 1, open **Ask Startly** and tell it something went wrong today, in your own words. Watch the timetable shift, the toast appear, and the chat say what moved. Then try "delete [a task]".
  Commit: `Reshuffle the day from chat with toast and moved summary`

- [x] **3. It asks instead of guessing, and overflow goes to later days**
  Becomes usable: If a change would push the day past 23:00, Startly asks "That puts you until 23:40. OK, or should I move '…' to tomorrow?" with **Keep it / Move it**, and nothing changes until you answer. A task that doesn't fit today and has a later deadline goes to the next day with free time (and the chat says where and why). One with no deadline makes Startly ask **Tomorrow / Drop it**. "Plan tomorrow" or "plan my weekend" works; if it doesn't know your free time for a day, it asks. Clicking the date opens the rolling 7-day week strip (planned hours, 📌), and clicking a day shows that day's tasks.
  Why now: "Asks instead of guessing" is the second half of the kernel, and overflow + week strip are what make those answers visible. It depends on `reshuffle` from slice 2.
  PRD ref: `prd.md > Planning the Day` (criteria 3–4, "plan tomorrow"), `prd.md > Reshuffling When the Day Changes` (criterion 3), `prd.md > Main Screen` (week strip), `prd.md > States and Boundaries` (week strip)
  Spec ref: `spec.md > Components` (Scheduler: overflow handling and day window, Tradeoff Questions and Pending Proposals, Week Strip, Top Bar), `spec.md > The AI Action Format` (`move_to_day`, `set_availability`, `set_end_of_day`, `plan_days`, `resolve_pending`)
  Build: Overflow handling + conflicts in the scheduler; `questions.ts`; `pending` in the store with option buttons in ChatMessage and `resolve_pending`; the remaining actions; the clickable date + WeekStrip + `selectedDate`.
  Verify (mechanical): Vitest: late day → conflict, not applied; overflow with deadline → lands on a later day within its free time; no deadline → conflict; unknown free time → question; `plan_days` for tomorrow places a full day. Playwright (API mocked): a late reshuffle shows the question, the plan is unchanged until **Keep it** / **Move it**, and each button gives the matching result; date click toggles the week strip, a day click shows its tasks.
  Learner check: Tell Startly a task takes much longer than planned, so the day would end late. It should ask you first. Try both answers. Then say "plan tomorrow, I'm free 18:00–23:00", click today's date and open tomorrow in the week strip.
  Commit: `Ask on tradeoffs, overflow to later days, week strip`

- [x] **4. Live through the day: Now, check-offs, celebration, rename**
  Becomes usable: The current block shows as the tinted **NOW · 1H40 LEFT** card with hover quick buttons (**Need more time / Not started / → Tomorrow**, no AI call). When a task's time runs out unchecked, it asks "Did you finish …?" with **✓ Done / Need more time / Skip to tomorrow**. Checking a task crosses it out and pops a varied encouraging toast; checking the last task of the day drops confetti and a celebration dialog with a quote and **Rest well**. Clicking a task name renames it in place ("✓ Renamed").
  Why now: The plan and the changes now work; this makes it something you live in during the day. It's mostly UI on top of existing scheduler functions, so it's low risk after the kernel.
  PRD ref: `prd.md > The Core Journey` (steps 4, 6), `prd.md > The Now Task and Unfinished Tasks`, `prd.md > Checking Off and Rewards`, `prd.md > Editing Tasks Directly`
  Spec ref: `spec.md > Components` (Now Card and Quick Buttons, Check-off Encouragement and Celebration, Timetable task card), `spec.md > Data Model` (`lastCelebratedDate`)
  Build: NowCard with time-left tick; quick-button store actions → `reshuffle`; the "Did you finish…?" state; Checkbox + toasts from `messages.ts`; Celebration (canvas-confetti + Dialog); inline rename.
  Verify (mechanical): Vitest: which block is Now at a given time; "Did you finish" detection; Need more time = +30 min and reshuffle; Not started = starts at now. Playwright with a fixed browser clock (`page.clock`): exactly one Now card; quick buttons move tasks with a toast; check / uncheck; checking the last task → celebration dialog; rename → survives reload.
  Learner check: Plan a short day that includes the current time. Hover the Now card and press **Need more time**. Check off tasks one by one until the last one, and rename one by clicking its name.
  Commit: `Now card, quick buttons, check-off rewards, celebration, rename`

- [x] **5. Make it yours: color, light/dark, grid view**
  Becomes usable: The ⋯ menu (on both screens) offers six swatches (Iris, Ocean, Sage, Plum, Coral, Ink) and a Light/Dark switch. Everything accent-colored recolors at once, including Startly's body, and both are remembered (first visit follows the system mode). The **List / Grid** switch shows the day as an hour grid with a current-time line.
  Why now: This is polish rather than proof of the kernel, so it comes after the core works. The token system is already in place from slice 1, so this mostly adds variants and the menu.
  PRD ref: `prd.md > The Settings Menu`, `prd.md > Main Screen` (List / Grid), `prd.md > Look and Feel`
  Spec ref: `spec.md > Look and Feel` (theme tokens), `spec.md > Components` (Settings Menu, Timetable grid view)
  Build: Accent × mode CSS variables, SettingsMenu popover, theme attributes on `<html>`, GridView.
  Verify (mechanical): `npm run build` passes. Playwright: pick each swatch → the `--accent` computed on the Now card / button / avatar changes; toggle dark → background `#161512`; reload keeps both; Grid view renders blocks at the right offsets with a now-line. Screenshots of light and dark for review.
  Learner check: Open ⋯, try a few colors and switch to dark mode, then reload. Switch to Grid and see if the day reads like a calendar.
  Commit: `Settings menu with accents and dark mode, grid view`

- [x] **6. Coming back the next morning**
  Becomes usable: On a new day, the chat starts fresh with a "Good morning" from Startly while the plan stays. If yesterday had unchecked tasks, it lists them with **Add both / Choose / Drop them**. Startly's replies include a short discipline nudge with a quote when it fits (e.g. you plan to start late on a packed day), and respects rest.
  Why now: It needs a day's worth of real state (tasks, checks, chat) to be meaningful, so it comes last. It completes the "coming back" step of the journey.
  PRD ref: `prd.md > The Core Journey` (step 7), `prd.md > The Assistant Chat`
  Spec ref: `spec.md > Components` (Daily Chat Reset, Assistant Server Route system prompt), `spec.md > Data Model`
  Build: The morning reset on load and on tab focus, greeting templates, the yesterday question with Choose checkboxes, re-placing today; nudge rules in the system prompt.
  Verify (mechanical): Vitest: reset clears the chat only when `chat.date ≠ today`; unchecked earlier tasks are found; each option gives the matching task list. Playwright with `page.clock` moved to the next day: greeting only, plan still shown, each button works. One real call: "I'll start at 12:00" on a packed day returns a reply with a nudge.
  Learner check: In DevTools, change `chat.date` in the `startly-v1` localStorage entry to yesterday (or I'll give you a one-liner) and reload. You should get a fresh "Good morning" and the question about unchecked tasks.
  Commit: `Daily chat reset, morning greeting, yesterday's tasks, nudges`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2: dump your real day, then tell Startly it went off track. This is where feedback on the AI's understanding and the timetable look can still shape slices 3–6.
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: 
Route and stops: 
Edit outcome: 
Reflection: 
Activity mode: 

## Revisions
- Vitest 3 instead of the latest Vitest — the latest needs Node 22, and this laptop runs Node 20.17. Same API for our tests.
- Browser checks run as committed `@playwright/test` specs (`npm run e2e`, API mocked) instead of only the Playwright MCP — the MCP browser was locked by another session, and committed specs can be rerun every slice.
- `.env` is loaded in `server/index.ts` with `process.loadEnvFile` — Node 20.17 has no `--env-file-if-exists` flag.
- GPT-6 Luna confirmed: the `gpt-6-luna` id works with `responses.parse` + `zodTextFormat` (real calls returned valid actions and resolved "Wednesday" to the right date). No fallback needed.
- For deploy (`6-ship`): Vercel needs a `vercel.json` rewrite `/api/(.*)` → `/api`, and the server's extensionless ESM imports must be checked (bundle or `.js` extensions) — found in the slice 1 code review.
- Split tasks become real tasks "X (cont.)" (new optional `Task.partOf`) — the build found that a task under way can run into a fixed meeting, be interrupted by a switch, or need more time after its slot; keeping the rest as its own saved task stops it drifting, lets it be reported when it doesn't fit, and lets delete/extend handle all parts.
- A `preferredStart` is a hold (later tasks must fit before it, it beats lunch/breaks) and is cleared once the task has started — "start X at 16:15" wasn't honoured otherwise.
- Tasks that don't fit are listed under the timetable, and the AI context marks each task `onTimetable` — at the first checkpoint the learner couldn't see an unplaced task and Startly insisted it was "already on the list".
- Real-model conversation checks (`npm run check:real`) added to every slice's verification — mocked browser tests and single real calls missed a realistic multi-message evening.
- Finish-by times (`endBy`), an end of day past midnight ("25:00" = 1 am), and `set_end_of_day`/`move_to_day` pulled forward from slice 3 — the learner's own test needed "before 20:00, the shop closes" and "I can stay until 1 am".
- Moved cards now glow briefly (accent tint) — the learner asked to see what moved; PRD decision updated.
- Startly suggests the order of the day (`order` in the AI response → task `rank`), and the code enforces hard limits — the learner decided at the checkpoint that planning the order is the AI's job; a task "started" under 15 min ago can still be reordered.
- "Doesn't fit, tomorrow or drop it?" doesn't hold the rest of the change back (the plan still appears); only a change that pushes a task already on today's timetable off the day waits for the answer — on a first dump, blocking hid the whole timetable.
- "Keep it" measures how late the day must run when you answer, and only for today (`dayEnds`); questions expire at midnight; a reply that doesn't answer keeps the question open — found by real-model conversations and code review.
- A later day laid out in advance is redone when it arrives (`preplanned`), and anything that no longer fits on a laid-out later day is listed as "Doesn't fit on <day>".
- Checking a task finishes all its parts and, if it was still running, ends it now so the next tasks move up; "→ Tomorrow" merges a split task back into one; "Not started" starts on the current 5-minute mark; the celebration waits for "Doesn't fit" tasks too — found by code review of slice 4.
- Yesterday's unchecked tasks are no longer carried over automatically (slice 1 did that); they wait on their day until the morning question is answered, and that question survives other messages (asked again if another question interrupts it). Split parts count as one leftover.
- "Today" is the planning day, not the calendar date: a day that runs past midnight (e.g. until 1 am) stays the same day until it ends (`dayOf`) — found by review: at 00:05 the app reset and called the 00:15 task a leftover.
- Discipline nudges only on a late start of a packed day, never on a light evening — the real model nudged on a light evening.
