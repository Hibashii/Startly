import type { Action } from '../../shared/schema'
import type { Plan, Task } from '@/types'
import { dateKey, toMin } from '@/lib/time'
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
      default:
        // Other actions arrive in later build steps.
        skipped.push(a)
    }
  }

  const { plan: next, unplaced } = reshuffleToday({ ...plan, tasks }, today, nowMin)
  return { plan: next, applied, skipped, unplaced }
}
