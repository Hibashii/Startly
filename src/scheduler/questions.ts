import type { Plan } from '@/types'
import { clock } from '@/lib/time'
import { msg, nameOf, type Text } from '@/i18n'
import type { AnyAction, ApplyResult } from './applyActions'
import { plusDays } from './days'
import { endOfDayFor } from './schedule'

/** "Keep it": let today run exactly as late as needed (measured when the answer is picked). */
export const AS_NEEDED = 'as-needed'

/** Replace AS_NEEDED with today's real end, measured by running the change with no end limit. */
export function measureAnswer(extra: AnyAction[], today: string, simulate: (extra: AnyAction[]) => ApplyResult): AnyAction[] {
  return extra.map((a) => {
    if (a.type !== 'set_day_end' || a.time !== AS_NEEDED) return a
    const late = simulate([{ type: 'set_day_end', date: today, time: '30:00' }])
    const until = (late.plan.blocks[today] ?? []).reduce((max, b) => (b.end > max ? b.end : max), '')
    return { ...a, time: until }
  })
}

export interface QuestionOption {
  id: string
  label: Text
  extra: AnyAction[] // added to the original change when this answer is picked
}

export interface Question {
  text: Text
  options: QuestionOption[]
  /** true: the change waits for the answer. false: the change applies now, the answer acts on top of it. */
  blocking: boolean
}

/**
 * When a change creates a real tradeoff, Startly asks instead of guessing (what to ask; the screen words it):
 * - a task that was on today's timetable got pushed off → "That puts you until 23:40. OK, or should I move it?"
 * - new tasks don't fit today and aren't due later → "Stay until 01:35, move them to Sunday, or drop them?" (the rest applies meanwhile)
 * `simulate` runs the same change plus extra actions, to measure the "keep it" option.
 */
export function findQuestion(
  prev: Plan,
  result: ApplyResult,
  today: string,
  simulate: (extra: AnyAction[]) => ApplyResult,
): Question | null {
  const wasUnplaced = new Set(prev.tasks.filter((t) => t.kind === 'task' && t.status === 'todo' && t.date === null).map((t) => t.id))
  // A task due later that's waiting for your free time gets that question instead.
  const waitingForFreeTime = new Set(result.needFreeTime.map((n) => n.id))
  const ids = result.unplaced.filter((x) => !wasUnplaced.has(x) && !waitingForFreeTime.has(x))
  if (!ids.length) return null
  const id = ids[0]
  const task = result.plan.tasks.find((t) => t.id === id)!
  const before = prev.tasks.find((t) => t.id === id)
  const tomorrow = plusDays(today, 1)
  const toTomorrow: AnyAction = { type: 'move_to_day', id, date: tomorrow }

  if (before?.date === today && before.start) {
    // It was on the timetable: how late would the day run if it stays?
    const late = simulate([{ type: 'set_day_end', date: today, time: '30:00' }])
    if (!late.unplaced.includes(id)) {
      const until = (late.plan.blocks[today] ?? []).reduce((max, b) => (b.end > max ? b.end : max), '')
      return {
        text: msg('qUntil', { until: clock(until), title: nameOf(task), date: tomorrow }),
        options: [
          // Measured again when answered: a minute later the day may need a little more.
          { id: 'keep', label: msg('keepIt'), extra: [{ type: 'set_day_end', date: today, time: AS_NEEDED }] },
          { id: 'move', label: msg('moveIt'), extra: [toTomorrow] },
        ],
        blocking: true,
      }
    }
  }
  // New tasks that don't fit: one question about all of them, with a real way out (staying later, measured).
  const tasks = ids.map((x) => result.plan.tasks.find((t) => t.id === x)!)
  const one = tasks.length === 1
  const late = simulate([{ type: 'set_day_end', date: today, time: '30:00' }])
  const canStay = ids.every((x) => !late.unplaced.includes(x))
  const until = clock((late.plan.blocks[today] ?? []).reduce((max, b) => (b.end > max ? b.end : max), ''))
  return {
    text: msg('qNoFit', { items: tasks.map(nameOf), end: clock(endOfDayFor(result.plan, today)), stay: canStay ? until : null, date: tomorrow }),
    options: [
      ...(canStay ? [{ id: 'stay', label: msg('stayUntil', { until }), extra: [{ type: 'set_day_end', date: today, time: AS_NEEDED } as AnyAction] }] : []),
      { id: 'tomorrow', label: msg('dayOption', { date: tomorrow }), extra: tasks.map((t): AnyAction => ({ type: 'move_to_day', id: t.id, date: tomorrow })) },
      { id: 'drop', label: msg(one ? 'dropIt' : 'dropThem'), extra: tasks.map((t): AnyAction => (t.partOf ? { type: 'remove_one', id: t.id } : { type: 'remove_task', id: t.id })) },
    ],
    blocking: false,
  }
}
