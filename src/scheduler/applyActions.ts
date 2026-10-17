import type { Action } from '../../shared/schema'
import type { Plan, Task } from '@/types'
import { dateKey, roundUp5, toHHMM, toMin } from '@/lib/time'
import { reshuffleToday } from './schedule'

export interface ApplyResult {
  plan: Plan
  applied: number
  skipped: Action[]
  unplaced: string[]
}

const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
/** null, or a real calendar date "YYYY-MM-DD" (rejects 2026-13-45) */
const isDate = (s: string | null) => {
  if (s === null) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00`)
  return !Number.isNaN(d.getTime()) && dateKey(d) === s
}

/** AI actions → task changes → scheduler. Invalid actions are skipped, valid ones applied. */
export function applyActions(plan: Plan, actions: Action[], today: string, nowMin: number): ApplyResult {
  let tasks = [...plan.tasks]
  let nextId = tasks.reduce((n, t) => Math.max(n, Number(t.id.slice(1)) || 0), 0) + 1
  let nextOrder = tasks.reduce((n, t) => Math.max(n, t.order), -1) + 1
  const skipped: Action[] = []
  let applied = 0
  const find = (id: string) => tasks.find((t) => t.id === id)
  const replace = (next: Task) => {
    tasks = tasks.map((t) => (t.id === next.id ? next : t))
  }
  const endOf = (t: Task) => toMin(t.start!) + t.durationMin
  const nowHHMM = toHHMM(roundUp5(nowMin))
  /** The rest of a split task, as a real task "X (cont.)". Held at now unless `held` is false. */
  const continuation = (t: Task, durationMin: number, held = true): Task => ({
    ...t,
    id: `t${nextId++}`,
    title: t.partOf ? t.title : `${t.title} (cont.)`,
    durationMin,
    date: null,
    start: null,
    preferredStart: held ? nowHHMM : null,
    status: 'todo',
    order: nextOrder++,
    partOf: t.partOf ?? t.id,
  })
  /** Tasks due right now that you haven't started (you're busy with something else): re-placed later. */
  const unplaceDueNow = (exceptId: string) => {
    tasks = tasks.map((o) =>
      o.id !== exceptId && o.kind === 'task' && o.status === 'todo' && o.date === today && o.start &&
      toMin(o.start) < nowMin && endOf(o) > nowMin
        ? { ...o, date: null, start: null }
        : o,
    )
  }

  for (const a of actions) {
    switch (a.type) {
      case 'add_task': {
        if (!a.title.trim() || a.durationMin < 5 || a.durationMin > 16 * 60 || !isDate(a.deadline) || !isDate(a.date) || (a.preferredStart && !isTime(a.preferredStart))) {
          skipped.push(a)
          break
        }
        const task: Task = {
          id: `t${nextId++}`,
          title: a.title.trim(),
          kind: 'task',
          durationMin: a.durationMin,
          priority: a.priority,
          deadline: a.deadline,
          preferredStart: a.preferredStart,
          date: a.date && a.date > today ? a.date : null, // a past or today's date → today
          start: null,
          status: 'todo',
          order: nextOrder++,
        }
        tasks.push(task)
        applied++
        break
      }
      case 'add_fixed': {
        if (!a.title.trim() || !isTime(a.start) || !isTime(a.end) || !isDate(a.date) || a.date < today || toMin(a.end) <= toMin(a.start)) {
          skipped.push(a)
          break
        }
        tasks.push({
          id: `t${nextId++}`,
          title: a.title.trim(),
          kind: 'fixed',
          durationMin: toMin(a.end) - toMin(a.start),
          priority: 'high',
          deadline: null,
          preferredStart: null,
          date: a.date,
          start: a.start,
          status: 'todo',
          order: nextOrder++,
        })
        applied++
        break
      }
      case 'update_task': {
        const t = find(a.id)
        if (!t || (a.durationMin !== null && (a.durationMin < 5 || a.durationMin > 16 * 60)) || !isDate(a.deadline) || (a.preferredStart && !isTime(a.preferredStart))) {
          skipped.push(a)
          break
        }
        const changed: Task = {
          ...t,
          title: a.title?.trim() || t.title,
          durationMin: a.durationMin ?? t.durationMin,
          priority: a.priority ?? t.priority,
          deadline: a.deadline ?? t.deadline,
          preferredStart: a.preferredStart ?? t.preferredStart,
        }
        // A new preferred time means the task should be re-placed, even if it was already under way.
        if (t.kind === 'task' && a.preferredStart && t.status === 'todo') {
          changed.date = null
          changed.start = null
        }
        replace(changed)
        applied++
        break
      }
      case 'remove_task': {
        if (!find(a.id)) {
          skipped.push(a)
          break
        }
        // Removing a task removes all its parts ("X (cont.)" too).
        const root = find(a.id)!.partOf ?? a.id
        tasks = tasks.filter((t) => t.id !== root && t.partOf !== root)
        applied++
        break
      }
      case 'started_at': {
        const t = find(a.id)
        if (!t || t.kind !== 'task' || !isTime(a.start) || (a.remainingMin !== null && (a.remainingMin < 5 || a.remainingMin > 16 * 60))) {
          skipped.push(a)
          break
        }
        const durationMin = a.remainingMin ?? t.durationMin
        const s = toMin(a.start)
        const future = s >= nowMin
        const rests: Task[] = []
        tasks = tasks.map((o) => {
          if (o.id === t.id || o.kind !== 'task' || o.status !== 'todo' || o.date !== today || !o.start) return o
          const os = toMin(o.start)
          if (!(os < s + durationMin && endOf(o) > s)) return o
          // Switching later from the task under way: it stops when this one starts; its rest comes later.
          if (future && os < nowMin) {
            if (s > os) {
              rests.push(continuation(o, endOf(o) - s, false))
              return { ...o, durationMin: s - os }
            }
          }
          // Whatever else was planned over that time wasn't happening: it gets re-placed later.
          return { ...o, date: null, start: null }
        })
        tasks.push(...rests)
        // Started earlier: it keeps that time. Starting now or later: that time is held.
        replace({ ...t, durationMin, date: today, start: a.start, status: 'todo', preferredStart: future ? a.start : null })
        applied++
        break
      }
      case 'extend_task': {
        const t = find(a.id)
        if (!t || t.kind !== 'task' || a.extraMin < 5 || a.extraMin > 8 * 60) {
          skipped.push(a)
          break
        }
        // Extend the latest part of the task (it may have been split into "X (cont.)").
        const root = t.partOf ?? t.id
        const parts = tasks.filter((o) => o.id === root || o.partOf === root)
        const startOf = (o: Task) => (o.start && o.date === today ? toMin(o.start) : Infinity)
        const latest = parts
          .filter((o) => o.status === 'todo' && (!o.start || o.date !== today || endOf(o) > nowMin))
          .sort((x, y) => startOf(y) - startOf(x))[0]
        if (latest) {
          replace({ ...latest, durationMin: latest.durationMin + a.extraMin })
        } else {
          // Its time is over: the extra time continues from now as "X (cont.)" (the past block stays),
          // and whatever was due now (you haven't started it, you're still on this) is re-placed after.
          unplaceDueNow(t.id)
          tasks.push(continuation(t, a.extraMin))
        }
        applied++
        break
      }
      default:
        // Multi-day actions (move_to_day, set_availability, plan_days, …) arrive in build step 3.
        skipped.push(a)
    }
  }

  if (applied) tasks = splitBlocked(tasks, today, nowMin, continuation)
  const { plan: next, unplaced } = reshuffleToday({ ...plan, tasks }, today, nowMin)
  return { plan: next, applied, skipped, unplaced }
}

/**
 * A task under way that runs into something that can't move (a fixed appointment, a done task,
 * another task under way) stops there; the rest becomes "X (cont.)", placed first after now.
 */
function splitBlocked(tasks: Task[], today: string, nowMin: number, continuation: (t: Task, min: number) => Task): Task[] {
  const span = (t: Task) => ({ id: t.id, start: toMin(t.start!), end: toMin(t.start!) + t.durationMin })
  const onToday = tasks.filter((t) => t.date === today && t.start)
  const obstacles = onToday.filter((t) => t.kind === 'fixed' || t.status === 'done').map(span)
  const underWay = onToday
    .filter((t) => t.kind === 'task' && t.status === 'todo' && toMin(t.start!) < nowMin)
    .sort((a, b) => toMin(a.start!) - toMin(b.start!))

  let out = tasks
  for (const t of underWay) {
    const { start, end } = span(t)
    if (obstacles.some((o) => o.start <= start && start < o.end)) {
      out = out.map((o) => (o.id === t.id ? { ...o, date: null, start: null } : o))
      continue
    }
    const cut = Math.min(end, ...obstacles.filter((o) => o.start > start && o.start < end).map((o) => o.start))
    if (cut < end) {
      out = out.map((o) => (o.id === t.id ? { ...o, durationMin: cut - start } : o))
      out = [...out, continuation(t, end - cut)]
    }
    obstacles.push({ id: t.id, start, end: cut })
  }
  return out
}
