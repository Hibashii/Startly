import { addDays, format, parseISO } from 'date-fns'
import type { Plan, Task, Window } from '@/types'
import { toMin } from '@/lib/time'
import { endOfDayFor, freeWindows, gapsBetween, scheduleDay, type DayEnds } from './schedule'
import { dateKey } from '@/lib/time'

// Days after today: free time, overflow by deadline, and laying a day out hour by hour.

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const weekdayKey = (date: string) => WEEKDAYS[parseISO(date).getDay()]
export const plusDays = (date: string, n: number) => format(addDays(parseISO(date), n), 'yyyy-MM-dd')
/** The Monday of that date's week (weeks run Monday to Sunday). */
export const mondayOf = (date: string) => plusDays(date, -((parseISO(date).getDay() + 6) % 7))
/** The 7 dates of the week that starts on `monday`. */
export const weekOf = (monday: string) => Array.from({ length: 7 }, (_, i) => plusDays(monday, i))

/** Your free time on a date: set for that date, else for that weekday, else your usual day (start → end), else unknown (null). */
export function windowsFor(plan: Plan, date: string): Window[] | null {
  const w = freeWindows(plan, date)
  if (w) return w
  const start = plan.settings.profile?.dayStart
  const end = endOfDayFor(plan, date)
  return start && toMin(start) < toMin(end) ? [{ start, end }] : null
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

/** Free time unknown, but every task that day has a time you gave ("gym tomorrow after 19:00"): from the first one. */
function timedOnly(plan: Plan, date: string): Window[] | null {
  const ts = plan.tasks.filter((t) => t.date === date && t.kind === 'task' && t.status === 'todo')
  if (!ts.length || ts.some((t) => !t.preferredStart)) return null
  const start = ts.map((t) => t.preferredStart!).sort((a, b) => toMin(a) - toMin(b))[0]
  const end = endOfDayFor(plan, date)
  return toMin(start) < toMin(end) ? [{ start, end }] : null
}

/** Lay a later day out hour by hour inside its free time. Returns null if the free time is unknown. */
export function planDay(plan: Plan, date: string): { plan: Plan; unplaced: string[] } | null {
  const w = windowsFor(plan, date) ?? timedOnly(plan, date)
  if (!w) return null
  const gaps = gapsBetween(w)
  // Re-place from scratch: tasks on that day lose their old start (fixed ones keep theirs).
  const tasks = plan.tasks.map((t) => (t.date === date && t.kind === 'task' && t.status === 'todo' ? { ...t, start: null } : t))
  const r = scheduleDay({
    date,
    tasks,
    prevBlocks: [],
    window: { start: w[0].start, end: w[w.length - 1].end },
    gaps,
    breaks: plan.settings.breaks,
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
export function dayOf(at: Date, plan: DayEnds): { today: string; nowMin: number } {
  const calendar = dateKey(at)
  const min = at.getHours() * 60 + at.getMinutes()
  const yesterday = plusDays(calendar, -1)
  const end = toMin(endOfDayFor(plan, yesterday))
  return end > 24 * 60 && min + 24 * 60 < end ? { today: yesterday, nowMin: min + 24 * 60 } : { today: calendar, nowMin: min }
}
