import type { Block, Plan, Task, Window } from '@/types'
import { roundUp5, toHHMM, toMin } from '@/lib/time'

// Pure scheduling rules. No React, no network: same input → same timetable.

export const LUNCH_MIN = 45
export const LUNCH_FROM = toMin('12:30')
export const LUNCH_UNTIL = toMin('14:00')
export const BREAK_MIN = 15
export const BREAK_AFTER = 90

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

/** deadline (soonest first, none last) → priority (high → low) → existing order */
export function compareTasks(a: Task, b: Task) {
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
}

export interface DayInput {
  date: string
  tasks: Task[] // all tasks; the ones for this date are picked out
  prevBlocks: Block[] // the day's current blocks (to keep past lunch/breaks)
  window: Window
  fromMin: number // nothing before this is re-placed (today: now)
  includeUnplaced: boolean // also place tasks with no date yet (today only)
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

  const locked: Span[] = []
  const starts: Record<string, string> = {}
  const toPlace: Task[] = []

  for (const t of tasks) {
    const onDay = t.date === date || (t.date === null && input.includeUnplaced)
    if (!onDay) continue
    if (t.kind === 'fixed') {
      if (t.start) locked.push(span(date, toMin(t.start), toMin(t.start) + t.durationMin, 'fixed', t.id))
      continue
    }
    const keeps = t.date === date && t.start !== null && (t.status === 'done' || toMin(t.start) < fromMin)
    if (keeps) {
      locked.push(span(date, toMin(t.start!), taskEnd(t), 'task', t.id))
      starts[t.id] = t.start!
    } else if (t.status === 'todo') {
      toPlace.push(t)
    }
  }
  let lunchTaken = false
  for (const b of prevBlocks) {
    if ((b.type === 'lunch' || b.type === 'break') && toMin(b.start) < fromMin) {
      locked.push({ start: toMin(b.start), end: toMin(b.end), block: b })
      if (b.type === 'lunch') lunchTaken = true
    }
  }
  locked.sort((a, b) => a.start - b.start)

  const queue = [...toPlace].sort(compareTasks)
  const placed: Span[] = []
  const lunchFits = winStart <= LUNCH_UNTIL && winEnd >= LUNCH_FROM + LUNCH_MIN
  let cursor = roundUp5(fromMin)
  let streak = 0 // minutes of back-to-back work since the last rest

  while (queue.length && cursor < winEnd) {
    // Step over a locked block the cursor is inside of.
    const inside = locked.find((s) => s.start <= cursor && cursor < s.end)
    if (inside) {
      const isRest = inside.block.type === 'lunch' || inside.block.type === 'break'
      streak = isRest ? 0 : streak + (inside.end - cursor)
      cursor = inside.end
      continue
    }
    const next = locked.find((s) => s.start > cursor)
    const limit = Math.min(next ? next.start : winEnd, winEnd)

    if (lunchFits && !lunchTaken && cursor >= LUNCH_FROM && cursor < LUNCH_UNTIL && cursor + LUNCH_MIN <= limit) {
      placed.push(span(date, cursor, cursor + LUNCH_MIN, 'lunch'))
      cursor += LUNCH_MIN
      lunchTaken = true
      streak = 0
      continue
    }
    if (streak >= BREAK_AFTER && cursor + BREAK_MIN <= limit) {
      placed.push(span(date, cursor, cursor + BREAK_MIN, 'break'))
      cursor += BREAK_MIN
      streak = 0
      continue
    }

    const i = queue.findIndex(
      (t) => (!t.preferredStart || toMin(t.preferredStart) <= cursor) && cursor + t.durationMin <= limit,
    )
    if (i >= 0) {
      const t = queue.splice(i, 1)[0]
      placed.push(span(date, cursor, cursor + t.durationMin, 'task', t.id))
      starts[t.id] = toHHMM(cursor)
      cursor += t.durationMin
      streak += t.durationMin
      continue
    }

    // Nothing fits here: jump to the next preferred start in this gap, or past the gap.
    const prefs = queue
      .map((t) => (t.preferredStart ? toMin(t.preferredStart) : Infinity))
      .filter((m) => m > cursor && m < limit)
    const jumpTo = prefs.length ? roundUp5(Math.min(...prefs)) : limit
    if (jumpTo - cursor >= BREAK_MIN) streak = 0
    if (jumpTo >= winEnd) break
    cursor = jumpTo
  }

  const blocks = [...locked, ...placed].sort((a, b) => a.start - b.start).map((s) => s.block)
  return { blocks, starts, unplaced: queue.map((t) => t.id) }
}

const DAY_END = 24 * 60

function span(date: string, start: number, end: number, type: Block['type'], taskId?: string): Span {
  end = Math.min(end, DAY_END) // a late task never shows as "24:30"
  const block: Block = { date, start: toHHMM(start), end: toHHMM(end), type }
  if (taskId) block.taskId = taskId
  return { start, end, block }
}

export interface ReshuffleResult {
  plan: Plan
  unplaced: string[]
}

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
    window: { start: '00:00', end: plan.settings.endOfDay },
    fromMin,
    includeUnplaced: true,
  })
  const unplaced = new Set(result.unplaced)
  const tasks = plan.tasks.map((t) => {
    if (result.starts[t.id] !== undefined) return { ...t, date: today, start: result.starts[t.id] }
    if (unplaced.has(t.id)) return { ...t, date: null, start: null }
    return t
  })
  return { plan: { ...plan, tasks, blocks: { ...plan.blocks, [today]: result.blocks } }, unplaced: result.unplaced }
}
