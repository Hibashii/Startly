import type { Block, Plan, Task, Window } from '@/types'
import { roundUp5, toHHMM, toMin } from '@/lib/time'

// Pure scheduling rules. No React, no network: same input → same timetable.

export const LUNCH_MIN = 45
export const LUNCH_FROM = toMin('12:30')
export const LUNCH_UNTIL = toMin('14:00')
export const BREAK_MIN = 15
export const BREAK_AFTER = 60
export const DEFAULT_BREAKS = { afterMin: BREAK_AFTER, lengthMin: BREAK_MIN }

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

/**
 * Startly's suggested order first (rank); tasks without one come after, by
 * deadline (soonest first, none last) → priority (high → low) → the order they were added.
 * Hard limits (fixed times, holds, finish-by times, end of day) are enforced while placing, whatever the order.
 */
export function compareTasks(a: Task, b: Task) {
  const ar = a.rank ?? null
  const br = b.rank ?? null
  if (ar !== br) {
    if (ar === null) return 1
    if (br === null) return -1
    return ar - br
  }
  if (a.deadline !== b.deadline) {
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline < b.deadline ? -1 : 1
  }
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return a.order - b.order
}

export const taskEnd = (t: Task) => toMin(t.start!) + t.durationMin

/**
 * Not before this time: your own preferred time, else where Startly planned it. Startly's time is
 * only a suggestion: one that would miss the task's finish-by time ("the shop closes at 20:00") is dropped,
 * so the task is placed earlier, where it fits.
 */
const holdOf = (t: Task) => {
  if (t.preferredStart) return t.preferredStart
  if (!t.slot || (t.endBy && toMin(t.slot) + t.durationMin > toMin(t.endBy))) return null
  return t.slot
}

interface Span {
  start: number
  end: number
  block: Block
  hidden?: boolean // time you're not free (between free windows): blocks placement, not drawn
}

export interface DayInput {
  date: string
  tasks: Task[] // all tasks; the ones for this date are picked out
  prevBlocks: Block[] // the day's current blocks (to keep past lunch/breaks)
  window: Window
  fromMin: number // nothing before this is re-placed (today: now)
  includeUnplaced: boolean // also place tasks with no date yet (today only)
  gaps?: Window[] // times inside the window you're not free (e.g. between two free windows)
  breaks?: { afterMin: number; lengthMin: number } // your break rule (default: 15 min after ~60 min of work)
}

export interface DayResult {
  blocks: Block[]
  starts: Record<string, string> // taskId → "HH:MM" for every task placed on this day
  unplaced: string[] // task ids that didn't fit (overflow)
}

/**
 * Places one day:
 * 1. fixed appointments at their exact times, never moved;
 * 2. done tasks and tasks that already started keep their times;
 * 3. the rest by deadline → priority → order, from max(fromMin, window start) rounded up to 5 min,
 *    filling gaps around fixed blocks (respecting preferredStart);
 * 4. lunch (45 min) at the first boundary at/after 12:30, a 15 min break after ~90 min of back-to-back work;
 * 5. whatever doesn't fit before the window ends is returned as unplaced.
 */
export function scheduleDay(input: DayInput): DayResult {
  const { date, tasks, prevBlocks, window } = input
  const breakAfter = Math.max(input.breaks?.afterMin ?? BREAK_AFTER, 1) // 0 = between every task
  const breakLen = input.breaks?.lengthMin ?? BREAK_MIN
  const winStart = toMin(window.start)
  const winEnd = toMin(window.end)
  const fromMin = input.fromMin // what started before this is under way

  const solid: Span[] = [] // fixed appointments and done tasks: never move, never cut
  const inProgress: Task[] = [] // started before now and not done: keep their start
  const starts: Record<string, string> = {}
  const toPlace: Task[] = []

  for (const t of tasks) {
    const onDay = t.date === date || (t.date === null && input.includeUnplaced)
    if (!onDay) continue
    if (t.kind === 'fixed') {
      if (t.start) solid.push(span(date, toMin(t.start), toMin(t.start) + t.durationMin, 'fixed', t.id))
      continue
    }
    const placedHere = t.date === date && t.start !== null
    if (placedHere && t.status === 'done') {
      solid.push(span(date, toMin(t.start!), taskEnd(t), 'task', t.id))
      starts[t.id] = t.start!
    } else if (placedHere && toMin(t.start!) < fromMin) {
      inProgress.push(t)
    } else if (t.status === 'todo') {
      toPlace.push(t)
    }
  }

  // Safety net: a task under way never draws over something that can't move.
  // (applyActions splits such tasks first, so normally nothing is cut here.)
  const locked: Span[] = [...solid]
  for (const g of input.gaps ?? []) locked.push({ ...span(date, toMin(g.start), toMin(g.end), 'fixed'), hidden: true })
  for (const t of inProgress.sort((a, b) => toMin(a.start!) - toMin(b.start!))) {
    const st = toMin(t.start!)
    const end = taskEnd(t)
    if (locked.some((o) => o.start <= st && st < o.end)) {
      toPlace.push(t)
      continue
    }
    const cut = Math.min(end, ...locked.filter((o) => o.start > st && o.start < end).map((o) => o.start))
    locked.push(span(date, st, cut, 'task', t.id))
    starts[t.id] = t.start!
  }

  let lunchTaken = false
  const work = [...locked]
  const overlapsWork = (b: Block) => work.some((s) => s.start < toMin(b.end) && s.end > toMin(b.start))
  // A task held for right now (you're still working) replaces a break that's still running.
  // Only holds set during that break count, not an old preferred time like "gym in the morning".
  const heldDuring = (b: Block) =>
    toPlace.some((t) => t.preferredStart !== null && toMin(t.preferredStart) >= toMin(b.start) && toMin(t.preferredStart) <= roundUp5(fromMin))
  for (const b of prevBlocks) {
    if (toMin(b.end) > fromMin && heldDuring(b)) continue
    // A past lunch/break stays, unless a task now covers that time (e.g. "I started at 16:00").
    // A past break only makes sense right after work that's still there.
    const followsWork = b.type === 'lunch' || work.some((s) => s.end === toMin(b.start))
    if ((b.type === 'lunch' || b.type === 'break') && toMin(b.start) < fromMin && !overlapsWork(b) && followsWork) {
      locked.push({ start: toMin(b.start), end: toMin(b.end), block: b })
      if (b.type === 'lunch') lunchTaken = true
    }
  }
  locked.sort((a, b) => a.start - b.start)

  const queue = [...toPlace].sort(compareTasks)
  const placed: Span[] = []
  const lunchFits = winStart <= LUNCH_UNTIL && winEnd >= LUNCH_FROM + LUNCH_MIN
  // Minutes of back-to-back work in the kept blocks that end exactly at `t` (so breaks stay put on later reshuffles).
  const workedUpTo = (t: number): number => {
    const prev = locked.find((s) => s.end === t && s.block.type !== 'lunch' && s.block.type !== 'break')
    return prev ? prev.end - prev.start + workedUpTo(prev.start) : 0
  }
  let cursor = roundUp5(Math.max(fromMin, winStart))
  let streak = workedUpTo(cursor) // minutes of back-to-back work since the last rest

  while (queue.length && cursor < winEnd) {
    // Step over a locked block the cursor is inside of.
    const inside = locked.find((s) => s.start <= cursor && cursor < s.end)
    if (inside) {
      const isRest = inside.hidden || inside.block.type === 'lunch' || inside.block.type === 'break' // time you're not free counts as rest
      if (isRest) streak = 0
      else if (cursor > inside.start) streak = workedUpTo(inside.start) + (inside.end - inside.start)
      else streak += inside.end - inside.start
      cursor = inside.end
      continue
    }
    const next = locked.find((s) => s.start > cursor)
    // Your own preferred time still ahead is a wall: whatever goes before it has to fit before it.
    // Startly's times are softer, like a school timetable: a task it planned for now may run into the next
    // planned time (that one just starts a little later), but a task with no planned time only fills a gap that fits.
    const hard = queue.map((t) => (t.preferredStart ? toMin(t.preferredStart) : Infinity)).filter((m) => m > cursor)
    const soft = queue.map((t) => (!t.preferredStart && holdOf(t) ? toMin(holdOf(t)!) : Infinity)).filter((m) => m > cursor)
    const limit = Math.min(next ? next.start : winEnd, winEnd, ...hard)
    const gapEnd = Math.min(limit, ...soft)

    // A task whose preferred time (yours) has arrived takes the slot first (before lunch or a break).
    // Startly's own times wait for lunch and breaks (below). A task must end before the next locked block,
    // a held time, and its own finish-by time.
    const fitsBy = (t: Task, by: number) => cursor + t.durationMin <= Math.min(by, t.endBy ? toMin(t.endBy) : Infinity)
    const fits = (t: Task) => fitsBy(t, gapEnd)
    let i = queue.findIndex((t) => t.preferredStart !== null && toMin(t.preferredStart) <= cursor && fitsBy(t, limit))
    // A finish-by task that would miss its time if lunch, a break or the next task in order came first goes now.
    if (i < 0) {
      // What would go next (as picked below): a task Startly planned for now or earlier, else the next in order.
      const nextUp =
        queue.find((t) => holdOf(t) !== null && toMin(holdOf(t)!) <= cursor && fitsBy(t, limit)) ??
        queue.find((t) => !holdOf(t) && fits(t))
      const wait = Math.max(LUNCH_MIN, nextUp && !nextUp.endBy ? nextUp.durationMin : 0)
      const urgent = queue
        // (Startly's planned time doesn't protect it from that: only a time you set yourself does.)
        .filter((t) => !t.preferredStart && (!holdOf(t) || toMin(holdOf(t)!) <= cursor + wait) && t.endBy && fitsBy(t, limit) && cursor + wait + t.durationMin > toMin(t.endBy))
        .sort((a, b) => toMin(a.endBy!) - toMin(b.endBy!))[0]
      if (urgent) i = queue.indexOf(urgent)
    }

    if (i < 0 && lunchFits && !lunchTaken && cursor >= LUNCH_FROM && cursor < LUNCH_UNTIL && cursor + LUNCH_MIN <= limit) {
      placed.push(span(date, cursor, cursor + LUNCH_MIN, 'lunch'))
      cursor += LUNCH_MIN
      lunchTaken = true
      streak = 0
      continue
    }
    if (i < 0 && streak >= breakAfter && cursor + breakLen <= limit) {
      placed.push(span(date, cursor, cursor + breakLen, 'break'))
      cursor += breakLen
      streak = 0
      continue
    }

    // Then a task Startly planned for now (or earlier), otherwise the next one in order that fits.
    if (i < 0) i = queue.findIndex((t) => holdOf(t) !== null && toMin(holdOf(t)!) <= cursor && fitsBy(t, limit))
    if (i < 0) i = queue.findIndex((t) => !holdOf(t) && fits(t))
    if (i >= 0) {
      const t = queue.splice(i, 1)[0]
      placed.push(span(date, cursor, cursor + t.durationMin, 'task', t.id))
      starts[t.id] = toHHMM(cursor)
      cursor += t.durationMin
      streak += t.durationMin
      continue
    }

    // Free time across lunchtime (the next task is planned later): lunch still gets its place.
    const lunchAt = roundUp5(Math.max(cursor, LUNCH_FROM))
    if (lunchFits && !lunchTaken && lunchAt < LUNCH_UNTIL && lunchAt + LUNCH_MIN <= gapEnd) {
      placed.push(span(date, lunchAt, lunchAt + LUNCH_MIN, 'lunch'))
      cursor = lunchAt + LUNCH_MIN
      lunchTaken = true
      streak = 0
      continue
    }

    // Nothing fits here: jump to the end of this gap (a planned or held time, or the next locked block).
    const jumpTo = roundUp5(gapEnd)
    if (jumpTo - cursor >= BREAK_MIN) streak = 0
    if (jumpTo >= winEnd) break
    cursor = jumpTo
  }

  const blocks = [...locked, ...placed].filter((s) => !s.hidden).sort((a, b) => a.start - b.start).map((s) => s.block)
  return { blocks, starts, unplaced: queue.map((t) => t.id) }
}

const DAY_END = 30 * 60 // 06:00 the next morning: the latest a day can run

function span(date: string, start: number, end: number, type: Block['type'], taskId?: string): Span {
  end = Math.min(end, DAY_END)
  const block: Block = { date, start: toHHMM(start), end: toHHMM(end), type }
  if (taskId) block.taskId = taskId
  return { start, end, block }
}

export interface ReshuffleResult {
  plan: Plan
  unplaced: string[]
}

/** Today's end: a one-day "keep it, I'll stay later" override, else the usual end of day. */
export type DayEnds = { settings: { endOfDay: string }; dayEnds?: Record<string, string> }
export const endOfDayFor = (plan: DayEnds, date: string) => plan.dayEnds?.[date] ?? plan.settings.endOfDay

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * The free time you gave for a date (that date, else its weekday), sorted, or null if you never said.
 * A window that runs to your usual bedtime ("free from 9") follows that day's end ("I can stay until 1 tonight");
 * one that ends earlier ("only until 21:00") stays, and nothing runs past a shorter one-day end.
 */
export function freeWindows(plan: Pick<Plan, 'availability' | 'settings' | 'dayEnds'>, date: string): Window[] | null {
  const given = plan.availability[date] ?? plan.availability[WEEKDAY_KEYS[new Date(`${date}T12:00:00`).getDay()]]
  if (!given?.length) return null
  const end = toMin(endOfDayFor(plan, date))
  const usual = toMin(plan.settings.endOfDay)
  const oneDay = plan.dayEnds?.[date] !== undefined
  const w = [...given]
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((x) => {
      const e = toMin(x.end)
      return { start: x.start, end: toHHMM(e >= usual ? (oneDay ? end : e) : Math.min(e, end)) }
    })
    .filter((x) => toMin(x.start) < toMin(x.end))
  return w.length ? w : null
}

export const gapsBetween = (w: Window[]): Window[] =>
  w.slice(1).flatMap((x, i) => (toMin(x.start) > toMin(w[i].end) ? [{ start: w[i].end, end: x.start }] : []))

/** Re-place today from `fromMin` (now) to the end of the day and write the result back into the plan. */
export function reshuffleToday(plan: Plan, today: string, fromMin: number): ReshuffleResult {
  // (Unfinished tasks from a past day stay there until you answer Startly's morning question.)
  // Free time you gave for today ("I only have 18:00–21:00 tonight") is kept; otherwise the whole day until its end.
  const free = freeWindows(plan, today) ?? [{ start: '00:00', end: endOfDayFor(plan, today) }]
  // An unfinished task the app put before your hours moves into them, even one shown as "now".
  const early = (t: Task) => t.date === today && t.kind === 'task' && t.status === 'todo' && !!t.start && toMin(t.start) < toMin(free[0].start)
  const result = scheduleDay({
    date: today,
    tasks: plan.tasks.map((t) => (early(t) ? { ...t, start: null } : t)),
    prevBlocks: plan.blocks[today] ?? [],
    window: { start: free[0].start, end: free[free.length - 1].end },
    gaps: gapsBetween(free),
    breaks: plan.settings.breaks,
    fromMin,
    includeUnplaced: true,
  })
  const unplaced = new Set(result.unplaced)
  const tasks = plan.tasks.map((t) => {
    const start = result.starts[t.id]
    if (start !== undefined) {
      // Once under way, a held time has done its job.
      const underWay = toMin(start) < fromMin
      return { ...t, date: today, start, preferredStart: underWay ? null : t.preferredStart, slot: underWay ? null : t.slot, preplanned: false }
    }
    if (unplaced.has(t.id)) return { ...t, date: null, start: null }
    return t
  })
  return { plan: { ...plan, tasks, blocks: { ...plan.blocks, [today]: result.blocks } }, unplaced: result.unplaced }
}
