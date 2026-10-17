---
doc: scope
status: approved
---

# [Name TBD] — your personal assistant for your day

A planner you talk to: dump what you have to do, get a school-style timetable, and when your day goes off track, tell it what happened and it reshuffles the rest of your day.

## The Unique Kernel
**A living timetable you change just by talking to it.** It's always there when you open the app, with no old ChatGPT conversation to dig up and no re-asking for the table. Tell it "I haven't started yet" or "I'm not done, I need more time," and it reshuffles the rest of the day. When there's a real tradeoff, it **asks you instead of guessing** ("Can you work until 23:00, or should I move this to tomorrow?").

## Who It's For
People who have a lot to do and don't know where to start, or who want to plan their week. For example:
- **Someone like her:** a recent graduate (August) finishing a 9-to-5 apprenticeship and job hunting. She comes home tired, and has too much in her head (gym, job applications, portfolio projects, learning). She procrastinates because she doesn't know where to start. Today she asks ChatGPT for a school-style timetable. It works, but she has to find the same conversation again to keep the context, and ask for the table every time it changes.
- **Students before exam week** who want a revision timetable.

## The Core Loop
1. She tells it, in plain words, everything she has to do and any due dates ("it's 12, I have to apply to jobs, do the hackathon, gym…"). She doesn't need to say "give me a plan."
2. It builds today's timetable with time blocks, and adds **lunch and breaks on its own**.
3. During the day she tells it what really happened: "I didn't start the hackathon yet, I'm starting now," or "I'm not done and it's break time, I need more time."
4. It reshuffles the rest of the day, shows what moved, and pushes anything that no longer fits into the next days, only where there's free time for it. When it can't decide alone, it asks.

She comes back because her plan is always there and stays realistic as the day changes.

## Inspiration & Identity
- Feels like a **personal assistant to a CEO that organizes your week**, where the CEO is you.
- A bit of personality: **discipline nudges** when they fit, e.g. you say you'll start at 12:00 on a packed day, and it suggests starting earlier with a quote like "Either you run the day or the day runs you." They're suggestions, not orders. If you've woken up early all week, sleeping in is fine.
- A **school timetable** feel: clear blocks, breaks, lunch.
- Laptop first (she works mostly on her laptop). The look and layout (calendar vs. list, task check-off) get decided in `3-prd` with design mockups.

## Why This Matters to the Learner
She lives this problem: "I have all these things in my head so I procrastinate… I just don't know with what to start." The ChatGPT timetable got her working this weekend, and she wants a version that keeps up with her. Others have it too: anyone juggling a job plus personal goals.

## What "Working" Looks Like
The demo story:
> **Before:** "Saturday: hackathon idea, gym, apply to 3 jobs, groceries." → it gives a timetable: 15:00–16:00 hackathon, lunch and breaks included, gym after…
> **Something goes wrong:** "I only started the hackathon at 16:00, and it needs 2 hours."
> **After:** the rest of the day shifts. Gym moves later, a job application moves to tomorrow, and **you can see exactly what changed**. If something would push the day too late, it asks first.

## The POC Boundary
- Plan **today in detail** as a timetable, with automatic lunch and breaks.
- **By default it plans the day.** It puts tasks on other days only when you ask for several days ("plan my weekend / my week"), or when a task doesn't fit today and its deadline is later. If a task doesn't fit and has no deadline, it asks.
- For other days, it **asks for your free time** (e.g. "work 9–5 on weekdays, free after 18:00") and estimates how long each task takes. Each day gets only as much as fits its free time. Upcoming days show as a list ("Tuesday: free 18:00–23:00, 3h planned"), and each one becomes a detailed timetable when that day comes or when you ask.
- Tasks are placed by **time, priority, and deadline**. If you don't like the plan, you just tell it how you want it ("put the gym in the morning").
- Fixed appointments (interview Wed 11:30–12:00, event Thu 18:00–20:00) stay put, and tasks are planned around them.
- Natural-language updates ("not started," "not finished," "add a task") reshuffle the rest of the day and show what moved.
- It asks when there's a real tradeoff.
- The plan **persists**: reopen the app and it's still there.
- Runs in the browser on a laptop.

## Later
- **Full week view** (plan Monday–Sunday hour by hour, click into a day). This is a stretch goal for the hackathon submission once the core works.
- Calendar/agenda sync (add blocks to her real calendar).
- Alarms and notifications ("break in 5 min," "gym tomorrow at…").
- Learning the person: real task durations, morning vs. night person, preferences like going to the gym when it's empty.
- Marking tasks done and progress tracking (may move into the PoC during `3-prd`).
- Mobile / responsive layout.

## Explicitly Cut
- **The junior job-search filter idea:** set aside. Reading a single post isn't the real problem, and she chose the planner.
- **A personal AI-workflow skill:** she'll build it later for herself. It's not something other people would use.
