import type { Plan } from '@/types'
import { clock } from '@/lib/time'
import type { AnyAction, ApplyResult } from './applyActions'
import { dayName, plusDays } from './days'
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
  label: string
  extra: AnyAction[] // added to the original change when this answer is picked
}

export interface Question {
  text: string
  options: QuestionOption[]
  /** true: the change waits for the answer. false: the change applies now, the answer acts on top of it. */
  blocking: boolean
}

/**
 * When a change creates a real tradeoff, Startly asks instead of guessing (texts written by code):
 * - a task that was on today's timetable got pushed off → "That puts you until 23:40. OK, or should I move it?"
 * - a new task doesn't fit today and isn't due later → "Tomorrow, or drop it?" (the rest applies meanwhile)
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
        text: `That puts you until ${clock(until)}. OK, or should I move '${task.title}' to ${dayName(tomorrow)}?`,
        options: [
          // Measured again when answered: a minute later the day may need a little more.
          { id: 'keep', label: 'Keep it', extra: [{ type: 'set_day_end', date: today, time: AS_NEEDED }] },
          { id: 'move', label: 'Move it', extra: [toTomorrow] },
        ],
        blocking: true,
      }
    }
  }
  // New tasks that don't fit: one question about all of them, with a real way out (staying later, measured).
  const tasks = ids.map((x) => result.plan.tasks.find((t) => t.id === x)!)
  const names = tasks.map((t) => `'${t.title}'`)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  const one = tasks.length === 1
  const late = simulate([{ type: 'set_day_end', date: today, time: '30:00' }])
  const canStay = ids.every((x) => !late.unplaced.includes(x))
  const until = (late.plan.blocks[today] ?? []).reduce((max, b) => (b.end > max ? b.end : max), '')
  const end = clock(endOfDayFor(result.plan, today))
  const ways = [canStay ? `stay until ${clock(until)}` : null, `move ${one ? 'it' : 'them'} to ${dayName(tomorrow)}`, `drop ${one ? 'it' : 'them'}`].filter(Boolean)
  return {
    text: `${list} ${one ? "doesn't" : "don't"} fit before ${end}. ${ways.join(', ').replace(/^./, (c) => c.toUpperCase()).replace(/, ([^,]*)$/, ', or $1')}?`,
    options: [
      ...(canStay ? [{ id: 'stay', label: `Stay until ${clock(until)}`, extra: [{ type: 'set_day_end', date: today, time: AS_NEEDED } as AnyAction] }] : []),
      { id: 'tomorrow', label: dayName(tomorrow), extra: tasks.map((t): AnyAction => ({ type: 'move_to_day', id: t.id, date: tomorrow })) },
      { id: 'drop', label: one ? 'Drop it' : 'Drop them', extra: tasks.map((t): AnyAction => (t.partOf ? { type: 'remove_one', id: t.id } : { type: 'remove_task', id: t.id })) },
    ],
    blocking: false,
  }
}
