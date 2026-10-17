import type { Block, Plan, Task, Window } from '@/types'
import { roundUp5, toHHMM, toMin } from '@/lib/time'

// Pure scheduling rules. No React, no network: same input → same timetable.

export const LUNCH_MIN = 45
export const LUNCH_FROM = toMin('12:30')
export const LUNCH_UNTIL = toMin('14:00')
export const BREAK_MIN = 15
export const BREAK_AFTER = 90

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
  const winStart = toMin(window.start)
  const winEnd = toMin(window.end)
  const fromMin = Math.max(input.fromMin, winStart)

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
  for (const b of prevBlocks) {
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
  let cursor = roundUp5(fromMin)
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
    // A preferred time still ahead is held: whatever goes before it has to fit before it.
    const holds = queue.map((t) => (t.preferredStart ? toMin(t.preferredStart) : Infinity)).filter((m) => m > cursor)
    const limit = Math.min(next ? next.start : winEnd, winEnd, ...holds)

    // A task whose preferred time has arrived takes the slot first (before lunch or a break).
    // A task must end before the next locked block, a held time, and its own finish-by time.
    const fits = (t: Task) => cursor + t.durationMin <= Math.min(limit, t.endBy ? toMin(t.endBy) : Infinity)
    let i = queue.findIndex((t) => t.preferredStart !== null && toMin(t.preferredStart) <= cursor && fits(t))
    // A finish-by task that would miss its time if lunch, a break or the next task in order came first goes now.
    if (i < 0) {
      const nextUp = queue.find((t) => !t.preferredStart && fits(t))
      const wait = Math.max(LUNCH_MIN, nextUp && !nextUp.endBy ? nextUp.durationMin : 0)
      const urgent = queue
        .filter((t) => !t.preferredStart && t.endBy && fits(t) && cursor + wait + t.durationMin > toMin(t.endBy))
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
    if (i < 0 && streak >= BREAK_AFTER && cursor + BREAK_MIN <= limit) {
      placed.push(span(date, cursor, cursor + BREAK_MIN, 'break'))
      cursor += BREAK_MIN
      streak = 0
      continue
    }

    // Otherwise the next one in order that fits.
    if (i < 0) i = queue.findIndex((t) => !t.preferredStart && fits(t))
    if (i >= 0) {
      const t = queue.splice(i, 1)[0]
      placed.push(span(date, cursor, cursor + t.durationMin, 'task', t.id))
      starts[t.id] = toHHMM(cursor)
      cursor += t.durationMin
      streak += t.durationMin
      continue
    }

    // Nothing fits here: jump to the end of this gap (a held time or the next locked block).
    const jumpTo = roundUp5(limit)
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
export const endOfDayFor = (plan: Plan, date: string) => plan.dayEnds?.[date] ?? plan.settings.endOfDay

/** Re-place today from `fromMin` (now) to the end of the day and write the result back into the plan. */
export function reshuffleToday(plan: Plan, today: string, fromMin: number): ReshuffleResult {
  // Unfinished tasks left on a past day come back to be placed today.
  const carried = plan.tasks.map((t) =>
    t.kind === 'task' && t.status === 'todo' && t.date !== null && t.date < today ? { ...t, date: null, start: null } : t,
  )
  plan = { ...plan, tasks: carried }
  const result = scheduleDay({
    date: today,
    tasks: plan.tasks,
    prevBlocks: plan.blocks[today] ?? [],
    window: { start: '00:00', end: endOfDayFor(plan, today) },
    fromMin,
    includeUnplaced: true,
  })
  const unplaced = new Set(result.unplaced)
  const tasks = plan.tasks.map((t) => {
    const start = result.starts[t.id]
    if (start !== undefined) {
      // Once under way, a held time has done its job.
      const preferredStart = toMin(start) < fromMin ? null : t.preferredStart
      return { ...t, date: today, start, preferredStart, preplanned: false }
    }
    if (unplaced.has(t.id)) return { ...t, date: null, start: null }
    return t
  })
  return { plan: { ...plan, tasks, blocks: { ...plan.blocks, [today]: result.blocks } }, unplaced: result.unplaced }
}
