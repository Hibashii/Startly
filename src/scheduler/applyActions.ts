import type { Action } from '../../shared/schema'
import type { Plan, Task, Window } from '@/types'
import { dateKey, roundUp5, toHHMM, toMin } from '@/lib/time'
import { reshuffleToday } from './schedule'
import { WEEKDAYS, overflowLater, planDay, weekdayKey } from './days'

/** Actions only the app itself sends (answers to Startly's questions), never the AI. */
export type InternalAction =
  | { type: 'set_day_end'; date: string; time: string }
  | { type: 'remove_one'; id: string } // drop just this part ("X (cont.)"), not the whole task
export type AnyAction = Action | InternalAction

export interface ApplyResult {
  plan: Plan
  applied: number
  skipped: AnyAction[]
  unplaced: string[] // didn't fit today and couldn't go to a later day
  movedLater: { id: string; date: string }[] // overflowed to a later day before its deadline
  needFreeTime: { id: string; date: string }[] // could go later, but free time that day is unknown
  unknownDays: string[] // "plan Sunday" but free time on Sunday is unknown
  plannedDays: string[] // later days laid out hour by hour
  laterUnplaced: { id: string; date: string }[] // on a laid-out later day, but it doesn't fit there
}

const isWindow = (w: Window) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) && /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(w.end) && toMin(w.end) > toMin(w.start)
const availabilityKey = (key: string) => {
  const k = key.trim().toLowerCase()
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k
  const day = WEEKDAYS.find((d) => k.startsWith(d))
  return day ?? null
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
export function applyActions(
  plan: Plan,
  actions: AnyAction[],
  today: string,
  nowMin: number,
  order: string[] | null = null,
  slots: { ref: string; start: string; date?: string | null }[] | null = null,
): ApplyResult {
  // A day laid out in advance is redone when it arrives: those times were a plan, not work under way.
  // (Done first, so nothing below mistakes them for tasks already started.)
  if (plan.tasks.some((t) => t.date === today && t.preplanned)) {
    const { [today]: _old, ...blocks } = plan.blocks
    plan = {
      ...plan,
      blocks,
      tasks: plan.tasks.map((t) => (t.date === today && t.preplanned ? { ...t, start: t.status === 'todo' ? null : t.start, preplanned: false } : t)),
    }
  }
  let tasks = [...plan.tasks]
  const before = new Set(tasks.map((t) => t.id))
  let nextId = tasks.reduce((n, t) => Math.max(n, Number(t.id.slice(1)) || 0), 0) + 1
  let nextOrder = tasks.reduce((n, t) => Math.max(n, t.order), -1) + 1
  const skipped: AnyAction[] = []
  const planDays = new Set<string>()
  let applied = 0
  const find = (id: string) => tasks.find((t) => t.id === id)
  const replace = (next: Task) => {
    tasks = tasks.map((t) => (t.id === next.id ? next : t))
  }
  const endOf = (t: Task) => toMin(t.start!) + t.durationMin
  const nowHHMM = toHHMM(roundUp5(nowMin))
  /** The rest of a split task, as a real task (same name, `partOf` set; shown as "X (cont.)"). Held at now unless `held` is false. */
  const continuation = (t: Task, durationMin: number, held = true): Task => ({
    ...t,
    id: `t${nextId++}`,
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
        if (!a.title.trim() || a.durationMin < 5 || a.durationMin > 16 * 60 || !isDate(a.deadline) || !isDate(a.date) || (a.preferredStart && !isTime(a.preferredStart)) || (a.endBy && !isTime(a.endBy))) {
          skipped.push(a)
          break
        }
        // Never a second copy of a task you already have on that day ("you didn't add the groceries!" when it's there).
        const day = a.date && a.date > today ? a.date : null
        const same = (t: Task) => before.has(t.id) && t.status === 'todo' && t.title.trim().toLowerCase() === a.title.trim().toLowerCase()
        if (tasks.some((t) => same(t) && (day ? t.date === day : t.date === null || t.date === today))) {
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
          endBy: a.endBy,
          date: a.date && a.date > today ? a.date : null, // a past or today's date → today
          start: null,
          status: 'todo',
          order: nextOrder++,
          ...(a.focus === false && { focus: false }),
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
        if (!t || (a.durationMin !== null && (a.durationMin < 5 || a.durationMin > 16 * 60)) || !isDate(a.deadline) || (a.preferredStart && !isTime(a.preferredStart)) || (a.endBy && !isTime(a.endBy))) {
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
          endBy: a.endBy ?? t.endBy ?? null,
        }
        // A new time constraint means the task should be re-placed, even if it was already under way.
        if (t.kind === 'task' && (a.preferredStart || a.endBy) && t.status === 'todo') {
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
        replace({ ...t, durationMin, date: today, start: a.start, status: 'todo', preferredStart: future ? a.start : null, preplanned: false })
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
      case 'set_end_of_day': {
        // After midnight ("01:00" = 1 am tonight) is stored past 24:00, so the day just runs longer.
        if (!isTime(a.time) && a.time !== '24:00') {
          skipped.push(a)
          break
        }
        const m = toMin(a.time)
        const time = m < toMin('06:00') ? toHHMM(m + 24 * 60) : a.time
        if (toMin(time) < toMin('12:00')) {
          skipped.push(a)
          break
        }
        // A new usual end replaces today's one-off "keep it" override.
        const { [today]: _dropped, ...dayEnds } = plan.dayEnds ?? {}
        plan = { ...plan, dayEnds, settings: { ...plan.settings, endOfDay: time } }
        applied++
        break
      }
      case 'move_to_day': {
        const t = find(a.id)
        if (!t || t.kind !== 'task' || !isDate(a.date) || a.date < today) {
          skipped.push(a)
          break
        }
        // Today → re-placed today; a later day → kept for that day (shown in the week strip).
        // A split task moves as one again: its unfinished parts merge back into the original.
        const root = t.partOf ?? t.id
        const parts = tasks.filter((o) => (o.id === root || o.partOf === root) && o.status === 'todo')
        const rootTask = find(root)
        const date = a.date > today ? a.date : null
        if (parts.length > 1 && rootTask) {
          const durationMin = parts.reduce((sum, o) => sum + o.durationMin, 0)
          tasks = tasks.filter((o) => o.partOf !== root || o.status === 'done')
          replace({ ...rootTask, status: 'todo', durationMin, date, start: null, preferredStart: null })
        } else {
          replace({ ...t, date, start: null })
        }
        applied++
        break
      }
      case 'set_availability': {
        const key = availabilityKey(a.key)
        if (!key || !a.windows.every(isWindow)) {
          skipped.push(a)
          break
        }
        plan = { ...plan, availability: { ...plan.availability, [key]: a.windows } }
        if (!a.windows.length) {
          // Not free that day (or that weekday) anymore: its layout goes, its tasks wait as a list.
          const affected = (d: string) => d > today && (d === key || weekdayKey(d) === key)
          plan = { ...plan, blocks: Object.fromEntries(Object.entries(plan.blocks).filter(([d]) => !affected(d))) }
        }
        applied++
        break
      }
      case 'plan_days': {
        const dates = a.dates.filter((d) => isDate(d) && d > today)
        if (!dates.length && !a.dates.includes(today)) {
          skipped.push(a)
          break
        }
        dates.forEach((d) => planDays.add(d))
        applied++
        break
      }
      case 'remove_one': {
        if (!find(a.id)) {
          skipped.push(a)
          break
        }
        tasks = tasks.filter((t) => t.id !== a.id)
        applied++
        break
      }
      case 'set_breaks': {
        if (a.afterMin < 0 || a.afterMin > 240 || a.lengthMin < 5 || a.lengthMin > 60) {
          skipped.push(a)
          break
        }
        plan = { ...plan, settings: { ...plan.settings, breaks: { afterMin: a.afterMin, lengthMin: a.lengthMin } } }
        applied++
        break
      }
      case 'set_day_end': {
        // "Keep it": today runs later, just this once.
        plan = { ...plan, dayEnds: { ...plan.dayEnds, [a.date]: a.time } }
        applied++
        break
      }
      case 'update_profile': {
        const old = plan.settings.profile ?? { focusBest: null, habits: '' }
        plan = { ...plan, settings: { ...plan.settings, profile: { focusBest: a.focusBest ?? old.focusBest, habits: a.habits?.trim() ?? old.habits } } }
        applied++
        break
      }
      default:
        // resolve_pending and undo are handled by the store (an answer it prepared; the plan before the last change).
        skipped.push(a)
    }
  }

  // Startly's suggested order for today: ids, or exact titles for tasks it just added.
  if (order?.length) {
    const added = tasks.filter((t) => !before.has(t.id))
    const ids = order
      .map((ref) => find(ref)?.id ?? added.find((t) => t.title.toLowerCase() === ref.trim().toLowerCase())?.id)
      .filter((id): id is string => !!id)
    if (ids.length) {
      const rank = new Map(ids.map((id, i) => [id, i]))
      // A task that "started" only minutes ago (e.g. right after planning) hasn't really begun: it can still move.
      const GRACE = 15
      const justStarted = (t: Task) => !!t.start && t.date === today && toMin(t.start) < nowMin && toMin(t.start) >= nowMin - GRACE
      const reorderable = (t: Task) =>
        t.kind === 'task' && t.status === 'todo' && (t.date === today || t.date === null) && (!(t.start && toMin(t.start) < nowMin) || justStarted(t))
      tasks = tasks.map((t) => {
        if (!reorderable(t)) return t
        const moved = { ...t, rank: rank.get(t.id) ?? null }
        return justStarted(t) && rank.has(t.id) ? { ...moved, date: null, start: null } : moved
      })
      applied++
    }
  }

  // Where Startly planned each task today: a soft hold the scheduler keeps, so the day reads like a timetable.
  if (slots?.length) {
    const added = tasks.filter((t) => !before.has(t.id))
    const at = new Map<string, string>()
    // A task added now is named by its title. The same title can come back on several days
    // ("Spanish" Mon to Sat): each slot takes the one on its day, and no task is used twice.
    const used = new Set<string>()
    // Only the copy on the slot's own day (a later date, or today = no date yet): never another day's.
    const byTitle = (ref: string, date: string | null) => {
      const day = date && date > today ? date : null
      return added.find((t) => !used.has(t.id) && t.title.toLowerCase() === ref.trim().toLowerCase() && t.date === day)?.id
    }
    const GRACE = 15
    const justStarted = (t: Task) => !!t.start && t.date === today && toMin(t.start) < nowMin && toMin(t.start) >= nowMin - GRACE
    // A task already under way stays where it is (unless it "started" only minutes ago, e.g. right after planning).
    const underWay = (t: Task) => t.date === today && !!t.start && toMin(t.start) < nowMin && !justStarted(t)
    for (const s of slots) {
      if (!isTime(s.start) || !isDate(s.date ?? null) || (s.date && s.date < today)) continue
      const id = find(s.ref)?.id ?? byTitle(s.ref, s.date ?? null)
      if (!id) continue
      used.add(id)
      if (s.date && s.date > today) {
        // A later day: the task goes there at that time, and that day is laid out hour by hour (below).
        // Only a task added now or already on a later day: one on today moves away only through move_to_day
        // (what you asked, or "Move it"), so a day never loses a task without you knowing.
        const t = find(id)
        if (t?.kind !== 'task' || t.status !== 'todo' || t.partOf || underWay(t)) continue
        if (before.has(t.id) && (t.date === null || t.date <= today)) continue
        if (t.date === s.date && t.slot === s.start) continue // already there: nothing changes
        replace({ ...t, date: s.date, start: null, slot: s.start, preplanned: false })
        planDays.add(s.date)
        applied++
        continue
      }
      at.set(id, s.start)
    }
    if (at.size) {
      let changed = 0
      tasks = tasks.map((t) => {
        const s = at.get(t.id)
        const movable = t.kind === 'task' && t.status === 'todo' && (t.date === today || t.date === null) && !underWay(t)
        if (s === undefined || !movable) return t
        // The same time again: nothing changes (even if the scheduler had to place it elsewhere, e.g. a past slot).
        if (t.slot === s && !justStarted(t)) return t
        const moves = justStarted(t) || (!!t.start && t.start !== s)
        changed++
        // A slot that is already past (planned this morning, it's now 14:00) just means "as soon as possible".
        return { ...t, slot: s, ...(moves ? { date: null, start: null } : {}) }
      })
      // (Only a real change counts: the same times sent again must not close an open question.)
      if (changed) applied++
    }
  }

  if (applied) tasks = splitBlocked(tasks, today, nowMin, continuation)
  const today_ = reshuffleToday({ ...plan, tasks }, today, nowMin)
  // What doesn't fit today and is due later goes to a later day with free time.
  const over = overflowLater(today_.plan, today_.unplaced, today)
  let next = over.plan
  const later = new Set(over.movedLater.map((m) => m.id))

  // Later days you asked to plan, or already laid out, are (re)laid out hour by hour.
  const unknownDays: string[] = []
  const plannedDays: string[] = []
  const laterUnplaced: ApplyResult['laterUnplaced'] = []
  const laidOut = Object.keys(next.blocks).filter((d) => d > today) // a key in blocks = that day was planned
  for (const d of [...new Set([...planDays, ...laidOut])].sort()) {
    const r = planDay(next, d)
    if (!r) {
      if (planDays.has(d)) unknownDays.push(d)
      continue
    }
    next = r.plan
    plannedDays.push(d)
    laterUnplaced.push(...r.unplaced.map((id) => ({ id, date: d })))
  }
  return {
    plan: next,
    applied,
    skipped,
    unplaced: today_.unplaced.filter((id) => !later.has(id)),
    movedLater: over.movedLater,
    needFreeTime: over.needFreeTime,
    unknownDays,
    plannedDays: plannedDays.filter((d) => planDays.has(d)),
    laterUnplaced,
  }
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
