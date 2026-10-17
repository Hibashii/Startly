---
doc: prd
status: approved
---

# Startly — Product Requirements

A personal assistant for your day: dump everything you have to do, get a school-style timetable, and when the day goes off track, tell it what happened and it reshuffles. It's for people who have a lot to do and don't know where to start (someone juggling a 9-to-5 and job hunting, or a student before exam week).
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **First open.** She sees the Startly name with the assistant's avatar next to it, the hook **"Don't know where to start? Start here."**, one line of three tiny steps (*1 Dump everything · 2 Get your timetable · 3 Tell me when things change*), and one input box ("Tell me everything you have to do…") with a **Plan my day →** button.
2. **The dump.** She types everything in plain words: tasks, deadlines, fixed appointments ("interview Wednesday 11:30–12:00"), and the current time if she wants ("it's 12:30…").
3. **The plan.** The main screen appears. Today is shown as an hour-by-hour timetable, with lunch and breaks added automatically. The assistant's chat opens on the right and summarizes what it did, including anything it moved to another day and why.
4. **During the day.** The current task is highlighted as **Now**. She checks tasks off as she finishes them, and each check gets a small encouraging pop-up.
5. **Something changes.** She tells the assistant ("I only started the hackathon at 16:00, it needs 2h"), or uses the quick buttons on the Now task. The rest of the day reshuffles, a short toast confirms it ("↻ Reshuffled 3 tasks"), and the chat says what moved. If there's a real tradeoff, the assistant asks first ("That puts you until 21:15. OK, or should I move 'Review notes' to tomorrow?").
6. **Day complete.** When every task of the day is checked, confetti falls and a rewarding message appears.
7. **Coming back.** She reopens Startly and her plan is still there.

**Success:** the demo story in `scope.md > What "Working" Looks Like` works end to end on screen: dump → timetable → "I started late" → reshuffled day that she can see.

## Screens and Layout
Laptop first, in the browser. Wireframes: `devpost/layout-sketches.html`, layout **I** (main screen), and `devpost/first-screen-sketches.html`, idea **5** (first screen).

### First-Time Screen
Centered and minimal (idea 5): the two-tone hook as the largest element, with the highlighter drawing itself under "Start here."; the 1 → 2 → 3 steps line underneath; then the big input box with the instruction as placeholder text (left-aligned) and the **Plan my day →** button inside it, at the bottom right. The avatar sits small next to "Startly" in the top bar, not in the middle, and the **⋯ menu** is on the right. Nothing else, so the eye lands on where to start. Details in `Look and Feel`.

### Main Screen
- **Top bar:** the avatar and "Startly" on the left. **Today's date** in the center: clicking it drops down the week strip, and clicking again hides it completely. On the right, the **⋯ menu** (color and light/dark, see `Features and Behavior > The Settings Menu`) and the **Ask Startly** pill (with avatar), which opens and closes the chat drawer and is tinted when the drawer is open.
- **Week strip (hidden by default):** a rolling 7 days that **always starts with today** (on Monday, Monday comes first). Each day shows how much is planned ("2h30") or a fixed appointment (📌). Past days aren't shown. Clicking a day shows that day's tasks.
- **Timetable (center):** the "Today" heading with a summary ("6h planned · until 21:15"), and a **List / Grid** switch right next to it. List is the default. Grid is an hour-grid view, like a calendar day view, with a line at the current time.
- **Chat drawer (right, about 40% of the width):** the full conversation, with the assistant's avatar next to its messages, and the input at the bottom. It slides in and out from the right. When it's closed, the timetable takes the space and stays centered at a comfortable width.

## Look and Feel
Final mockup: `devpost/startly-design.html` (use it as the visual reference for the build).

- **Name:** Startly. **Hook:** "Don't know where to start? Start here." It's the hero of the first screen, with very little around it.
- **Mood:** professional, calm and grown-up, like ChatGPT or Claude, not a kids' app. A personal assistant to a CEO (you), with a **school timetable** feel: clear blocks, breaks, lunch. Things appear only when they're useful, because the user already feels overwhelmed.
- **Font: SF Pro** (the Mac system font), everywhere. She may revisit it after the build, but not now.
- **Light mode:** pure white background with neutral grays. No cream, beige or yellowish off-white (she found the earlier `#fbfbf9` ugly). **Dark mode:** the warm near-black from layout I (background `#161512`, cards `#201f1b` / `#2b2924`), which she loves.
- **Color:** one accent color drives the Now card, checkboxes, buttons, your chat bubbles, the highlighter and the avatar. **Palette = the "softer" set:** Iris (default), Ocean, Sage, Plum, Coral, and Ink (no color). The user picks it from the ⋯ menu in the top bar, and Startly remembers it. Each color has a lighter version for dark mode.
- **First screen:** the hook in **two tones**. "Don't know where to start?" is softer and gray (dark gray in light mode so it stays readable), and **"Start here."** is strong, with an accent **highlighter stroke that draws itself** when the page opens. Below it, the 1 → 2 → 3 steps with arrows, numbers in neutral gray circles. Then a **big ChatGPT-style input box** (multi-line, rounded, soft shadow) with **Plan my day →** at the bottom right. No avatar in the middle. She found avatar + highlighter + colored steps "too much: the hook, we don't even read it."
- **Main screen:** layout I task cards (filled rounded blocks, dashed outlines for breaks and lunch, finished tasks faded and crossed out), the Now task as a tinted card with an accent bar on the left and an uppercase **NOW · 1H40 LEFT** tag, pill-shaped quick buttons, and a dark pill toast. The chat is ChatGPT-style: Startly's messages are plain text next to its avatar, yours are tinted bubbles, and the input is rounded with a round send button.
- **Assistant: Startly** (same name as the app), with the **Boss avatar in the original glossy style:** a rounded-square body with a gradient and a shine, pink blush, open dark eyes, and a dark headset and bow tie (like the Sky / Sunny-Boss cards in `devpost/first-screen-sketches.html`). **Only the body color changes:** it follows the palette color and is a bit richer in dark mode. Eyes, headset and bow tie stay dark (`#1b1b1f`) in both modes. Shown at ~28px next to "Startly" in the top bar, in the **Ask Startly** pill, and on its chat messages.
- **Avoid:** loud colors for state (like the rejected orange "moved" highlight), a progress bar at the top, too much text on screen, and stacking several eye-catching things on one screen.
- **Component style:** **shadcn/ui** (buttons, inputs, toasts, drawers, checkboxes). It needs React + Tailwind, which `4-spec` confirms.
- **Process note:** the `frontend-design` skill isn't used for Startly's visuals; she found its output "horrific."

## Features and Behavior

### Planning the Day
Source: `scope.md > The POC Boundary`.
- The assistant turns a plain-language dump into **today's timetable**, with **lunch and breaks added on its own** (she doesn't have to ask for them).
- Tasks are placed by **time, priority, and deadline**, around **fixed appointments**, which never move.
- **By default it plans the day.** It puts tasks on other days only when she asks ("plan my weekend / my week" or "plan tomorrow"), or when a task doesn't fit today and its deadline is later. Each day only gets as much as fits its **free time**. If it doesn't know her free time for a day, it asks.
- If a task doesn't fit and has **no deadline**, it asks what to do.
- "Plan tomorrow" gives tomorrow's full hour-by-hour timetable.
  - [ ] Typing a dump of 4–5 tasks with one fixed appointment produces a timetable for today with lunch and at least one break that she didn't type.
  - [ ] The fixed appointment appears at exactly the time she gave.
  - [ ] A task that doesn't fit today and has a later deadline appears on a later day in the week strip, not in today's timetable, and the chat says where it went.
  - [ ] A task that doesn't fit and has no deadline makes the assistant ask instead of silently placing it.

### Reshuffling When the Day Changes
Source: `scope.md > The Unique Kernel`.
- She can tell the assistant what happened in natural language: "not started yet," "I'm not done, I need more time," "add: call the bank, 30 min," or "put the gym in the morning."
- The **Now** task has quick buttons that appear on hover: **Need more time**, **Not started**, **→ Tomorrow**.
- After a change, the rest of the day reshuffles. Moved cards **glow softly in the accent color and fade back** after about 2 seconds (no persistent highlight). A short toast says what happened ("↻ Reshuffled 3 tasks"), and the chat lists what moved.
- She can give time limits in plain words: "groceries before 20:00, the shop closes" (finished by), "gym after 18:00" (not before), and "I can stay up until 1 am" (the day runs past midnight).
- A task that doesn't fit is never invisible: it's listed under the timetable as "Doesn't fit before 23:00".
- When a change creates a real tradeoff (the day would run late, something no longer fits), the assistant **asks instead of guessing**.
- **Deleting a task**, changing its duration, or moving it is done by asking the assistant.
  - [ ] Saying "I only started [task] at 16:00 and it needs 2 hours" moves every later task so nothing overlaps, and the chat names what moved.
  - [ ] A toast appears briefly after every reshuffle and then disappears.
  - [ ] If the reshuffle would push the day past her usual end time, the assistant asks before applying it.
  - [ ] "Delete groceries" removes the task, and the day closes the gap.

### The Now Task and Unfinished Tasks
- The task happening right now is highlighted in the timetable with "● Now · [time left]".
- When a task's time is over and it isn't checked, the Now highlight stays on it and asks: **"Did you finish [task]?"**, with **✓ Done / Need more time / Skip to tomorrow**. If she ignores it, the task stays where it is and nothing changes until she answers. No nagging.
  - [ ] At the current time, exactly one task shows the Now highlight.
  - [ ] After a task's end time passes unchecked, the "Did you finish…?" question appears, and each button produces the matching result.

### Checking Off and Rewards
- Each task has a **small checkbox**. Checking it crosses the task out, pops a little confetti burst from the checkbox, and shows a **cheer**: a bold pill in the accent color whose words follow the day's progress ("Great start! 🚀", "Halfway there 💪", "One more to go 🔥") with "3 of 5 done" dots (made more motivating in the final review).
- When **every task of the day** is checked: **confetti** plus a rewarding, touching message with a discipline quote, chosen from several so it isn't always the same (e.g. "You cooked today. Every box checked. Go rest, you deserve it." with "Discipline is choosing between what you want now and what you want most."). A **Rest well** button closes it.
  - [ ] Checking a task crosses it out and shows a pop-up. Unchecking undoes it.
  - [ ] Checking the last task of the day shows confetti and a celebration message. Doing it again on another day can show a different message.

### Editing Tasks Directly
- Clicking a task's **name** lets her rename it in place. Enter saves, and a toast confirms ("✓ Renamed"). Everything else goes through the assistant.
  - [ ] Renaming a task updates it in the timetable and it stays renamed after reopening the app.

### The Settings Menu
- A **⋯ button** in the top bar (on both screens) opens a small menu with two things:
  - **Color:** six round swatches: **Iris** (default), **Ocean**, **Sage**, **Plum**, **Coral**, **Ink**. Clicking one recolors the app right away: the Now card, checkboxes, buttons, chat bubbles, the highlighter and Startly's body.
  - **Light / Dark:** a switch between the two modes.
- Clicking outside closes the menu. Both choices are remembered.
- **Start fresh…** (added in the final review): deletes the plan, chat and free times after an "Are you sure?", and returns to the first screen. The chat drawer also has a **Clear chat** button (the plan stays).
- *Assumption:* on the very first visit the mode matches the computer's setting, until she switches it herself.
- The mockup (`devpost/startly-design.html`) still shows a 🎨 button. The ⋯ menu replaces it.
  - [ ] Picking a swatch changes the accent everywhere on screen at once, including the avatar, in both light and dark mode.
  - [ ] The Light / Dark switch flips the whole app, and both modes look right (pure white light mode, warm near-black dark mode).
  - [ ] The chosen color and mode are still applied after closing and reopening the app.

### The Assistant Chat
- Full conversation, with the assistant's avatar on its messages.
- **The chat starts fresh each morning** with a "Good morning" from the assistant. The **plan carries over**.
- **Yesterday's unchecked tasks:** in its "Good morning," Startly asks: *"2 things from yesterday weren't checked: Groceries, Job application #3. Add them to today?"* with **Add both / Choose / Drop them**.
- **Discipline nudges:** when they fit (e.g. she says she'll start at 12:00 on a packed day), the assistant suggests something with a short quote ("Either you run the day or the day runs you."). They're suggestions, not orders, and it respects rest (sleeping in after an early week is fine).
  - [ ] On a new day, the chat is empty apart from a greeting, and the plan is still shown.
  - [ ] If yesterday had unchecked tasks, the greeting lists them, and each button does what it says.

## States and Boundaries
- **First use:** only the first-time screen (see `Screens and Layout > First-Time Screen`).
- **Unclear or empty dump:** the assistant asks a follow-up question instead of producing an empty or made-up plan.
- **Nothing left today:** everything is checked, so it shows the celebration and then a calm "day complete" timetable.
- **Persistence:** the plan (all days, checked state, names) survives closing and reopening the browser. The chat history is cleared each morning.
- **Week strip:** hidden until she clicks the date. It shows today plus the next 6 days. Past days aren't viewable.
- **One person, one browser:** no accounts and no sharing.

## Product Decisions
- **Layout I:** timetable in the center, chat as a drawer on the right, week from the date. She found the other layouts either too busy or missing the full conversation. Days on top, rather than a side column, keep the laptop screen from being squeezed into three columns.
- **Show things only when needed:** a minimal first-time screen, week hidden by default, quick buttons on hover. Her reason: "if we have a lot of things the user will get lost."
- **A short fading glow on moved tasks, plus a toast** (changed during the build): after trying it, she wanted to see what moved. The glow uses the accent tint and leaves on its own; the rejected orange "warning" highlight stays out.
- **Rename by click; delete and other changes via the assistant:** keeps v1 small.
- **Checking off is in v1** (moved from scope's *Later*). Her reason: "the feeling of checking a task makes me happy and motivates me to continue."
- **The chat resets daily and the plan persists.** Old conversation becomes clutter, and the plan is what matters.
- **Rolling week starting today**, with no past days in v1.
- **Hook:** "Don't know where to start? Start here." It's her problem in her own words.
- **Name:** Startly.
- **First screen = idea 5** (hook + three steps + input), with the avatar next to the name. She chose it to stop going back and forth. A user who's overwhelmed needs one obvious thing to do.
- **Avatar = Boss**, with colors from the theme. Swapping avatars comes later.
- **The assistant is called Startly**, like the app. Her reason: it's logical, since that's the app's name. (Replaces the earlier name, Kai.)
- **Startly asks about yesterday's unchecked tasks** each morning: it never silently overloads the day, and never loses a task.
- **Professional, not childish:** used by students and adults, and should feel as polished as ChatGPT or Claude.
- **Design direction:** pieced together by her from four rounds of options. SF Pro; pure white light mode; the warm layout I dark mode; layout I cards; ChatGPT-style input and chat. Her reason for adding color: "otherwise this app looks so sad."
- **The user picks the color** (six presets, the "softer" set). This is polish rather than proof of the core idea, so it stays small: presets only, no color wheel.
- **First screen = hook only + highlighter, in two tones.** One thing stands out. Her reason: with the avatar, the highlighter and colored steps all together, "the hook, we don't even read it."
- **One ⋯ menu for settings** (color + light/dark) instead of separate buttons: keeps the top bar clean.
- **Glossy Boss avatar, body follows the color.** The flat one-color version looked wrong in light mode (white eyes and headset).

## What We're Building
- The first-time screen and the main screen (layout I), laptop browser.
- A plain-language dump turned into today's timetable, with auto lunch and breaks, fixed appointments, and priority and deadlines.
- Overflow to upcoming days by deadline and free time; multi-day planning when asked; "plan tomorrow".
- Reshuffling from chat messages and Now-task buttons, with a toast and a chat summary; asking on tradeoffs.
- The Now highlight and the "Did you finish…?" question.
- Checkboxes, encouraging pop-ups, and the end-of-day confetti with varied messages.
- Renaming in place.
- The ⋯ settings menu: six accent colors and a Light / Dark switch, both remembered.
- The chat drawer with avatar, a daily fresh chat, and discipline nudges.
- The week strip from the date: rolling 7 days.
- The List / Grid view switch.
- The plan persists between visits.

## Deferred From the POC
- **Seeing past days / yesterday's tasks:** she'll add it later. The week only looks forward in v1.
- **Drag-and-drop rearranging:** much more work, and the assistant can move things.
- **Editing duration/time or deleting by clicking:** the assistant handles it in v1.
- **Accounts and sync across devices:** one browser is enough for the demo.
- **Full week grid view** (every day hour by hour): stretch goal from `scope.md > Later`, if time allows.

## Possible Later Enhancements
- Calendar / agenda sync, and alarms or notifications ("break in 5 min").
- Learning the person: real task durations, morning vs. night, quiet gym hours.
- Mobile / responsive layout.
- Choosing between several avatars (Sunny, Boss, …).
- Clickable starters under the input ("Plan my week," "Exam revision," "I'm overwhelmed") to avoid the blank box.

## Non-Goals
- **Not a general chatbot:** the chat exists to change the plan, not for open conversation.
- **Not a to-do list app:** the timetable, with times, breaks and reshuffling, is the product.
- **No job-search features:** cut in `scope.md > Explicitly Cut`.

## Open Questions
- **"Usual end time" for the late-day question** (e.g. 23:00): fixed, or asked once? Decided in `4-spec`.
