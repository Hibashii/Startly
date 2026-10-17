import { addDays, format, parseISO } from 'date-fns'
import type { Plan, Task, Window } from '@/types'
import { toMin } from '@/lib/time'
import { endOfDayFor, scheduleDay } from './schedule'
import { dateKey } from '@/lib/time'

// Days after today: free time, overflow by deadline, and laying a day out hour by hour.

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const weekdayKey = (date: string) => WEEKDAYS[parseISO(date).getDay()]
export const dayName = (date: string) => format(parseISO(date), 'EEEE')
export const shortDay = (date: string) => format(parseISO(date), 'EEE')
export const plusDays = (date: string, n: number) => format(addDays(parseISO(date), n), 'yyyy-MM-dd')

/** Your free time on a date: set for that date, else for that weekday, else unknown (null). */
export function windowsFor(plan: Plan, date: string): Window[] | null {
  const w = plan.availability[date] ?? plan.availability[weekdayKey(date)]
  return w && w.length ? [...w].sort((a, b) => toMin(a.start) - toMin(b.start)) : null
}

const freeMinutes = (w: Window[]) => w.reduce((sum, x) => sum + toMin(x.end) - toMin(x.start), 0)
const plannedOn = (plan: Plan, date: string) =>
  plan.tasks.filter((t) => t.date === date && t.status === 'todo').reduce((sum, t) => sum + t.durationMin, 0)

/** Room for one more task on that day? Keeps ~15% for breaks. */
function hasRoom(plan: Plan, date: string, task: Task) {
  const w = windowsFor(plan, date)
  return !!w && plannedOn(plan, date) + task.durationMin <= freeMinutes(w) * 0.85
}

export interface Overflow {
  plan: Plan
  movedLater: { id: string; date: string }[] // went to a later day before its deadline
  needFreeTime: { id: string; date: string }[] // could go later, but your free time that day is unknown
}

/** Tasks that didn't fit today and are due later go to the first later day (up to the deadline) with room. */
export function overflowLater(plan: Plan, unplaced: string[], today: string): Overflow {
  const movedLater: Overflow['movedLater'] = []
  const needFreeTime: Overflow['needFreeTime'] = []
  for (const id of unplaced) {
    const t = plan.tasks.find((x) => x.id === id)
    if (!t?.deadline || t.deadline <= today) continue
    let placed: string | null = null
    let unknown: string | null = null
    for (let d = plusDays(today, 1); d <= t.deadline && d <= plusDays(today, 6); d = plusDays(d, 1)) {
      if (!windowsFor(plan, d)) {
        unknown ??= d
        continue
      }
      if (hasRoom(plan, d, t)) {
        placed = d
        break
      }
    }
    if (placed) {
      const date = placed
      plan = { ...plan, tasks: plan.tasks.map((x) => (x.id === id ? { ...x, date, start: null } : x)) }
      movedLater.push({ id, date })
    } else if (unknown) {
      needFreeTime.push({ id, date: unknown })
    }
  }
  return { plan, movedLater, needFreeTime }
}

/** Lay a later day out hour by hour inside its free time. Returns null if the free time is unknown. */
export function planDay(plan: Plan, date: string): { plan: Plan; unplaced: string[] } | null {
  const w = windowsFor(plan, date)
  if (!w) return null
  const gaps: Window[] = []
  for (let i = 1; i < w.length; i++) if (toMin(w[i].start) > toMin(w[i - 1].end)) gaps.push({ start: w[i - 1].end, end: w[i].start })
  // Re-place from scratch: tasks on that day lose their old start (fixed ones keep theirs).
  const tasks = plan.tasks.map((t) => (t.date === date && t.kind === 'task' && t.status === 'todo' ? { ...t, start: null } : t))
  const r = scheduleDay({
    date,
    tasks,
    prevBlocks: [],
    window: { start: w[0].start, end: w[w.length - 1].end },
    gaps,
    fromMin: toMin(w[0].start),
    includeUnplaced: false,
  })
  const next = tasks.map((t) => (r.starts[t.id] !== undefined && t.kind === 'task' ? { ...t, start: r.starts[t.id], preplanned: true } : t))
  return { plan: { ...plan, tasks: next, blocks: { ...plan.blocks, [date]: r.blocks } }, unplaced: r.unplaced }
}

/**
 * Which planning day it is. A day that runs past midnight ("until 1 am" = "25:00") is still that day
 * until it ends: at 00:30 it's yesterday at "24:30", not a new day.
 */
export function dayOf(at: Date, plan: Plan): { today: string; nowMin: number } {
  const calendar = dateKey(at)
  const min = at.getHours() * 60 + at.getMinutes()
  const yesterday = plusDays(calendar, -1)
  const end = toMin(endOfDayFor(plan, yesterday))
  return end > 24 * 60 && min + 24 * 60 < end ? { today: yesterday, nowMin: min + 24 * 60 } : { today: calendar, nowMin: min }
}
