import { describe, expect, it } from 'vitest'
import type { Action } from '../../shared/schema'
import type { Block, Plan } from '@/types'
import { toMin } from '@/lib/time'
import { applyActions, type AnyAction } from './applyActions'
import { findQuestion, measureAnswer } from './questions'

const TODAY = '2026-10-17' // a Saturday
const SUN = '2026-10-18'
const MON = '2026-10-19'
const add = (title: string, durationMin: number, deadline: string | null = null): Action => ({
  type: 'add_task', title, durationMin, priority: 'medium', deadline, preferredStart: null, endBy: null, date: null,
})
const empty = (): Plan => ({ tasks: [], blocks: {}, availability: {}, settings: { accent: 'iris', theme: null, endOfDay: '23:00' } })
const byTitle = (p: Plan, title: string) => p.tasks.find((t) => t.title === title)!
const free = (key: string, start: string, end: string): Action => ({ type: 'set_availability', key, windows: [{ start, end }] })
function noOverlap(blocks: Block[]) {
  for (let i = 1; i < blocks.length; i++) expect(toMin(blocks[i].start)).toBeGreaterThanOrEqual(toMin(blocks[i - 1].end))
}

describe('overflow to later days', () => {
  it("a task that doesn't fit today and is due later goes to the next day with free time", () => {
    // Big is due today, so it goes first; Report (due Monday) no longer fits today.
    const r = applyActions(empty(), [free('sun', '10:00', '18:00'), add('Big', 200, TODAY), add('Report', 120, MON)], TODAY, toMin('19:00'))
    expect(byTitle(r.plan, 'Report').date).toBe(SUN)
    expect(r.movedLater).toEqual([{ id: byTitle(r.plan, 'Report').id, date: SUN }])
    expect(r.unplaced).toEqual([])
  })

  it('skips a day without room, never past the deadline', () => {
    const r = applyActions(empty(), [
      free('sun', '10:00', '11:00'), free('mon', '18:00', '23:00'),
      add('Big', 230, TODAY), add('Report', 120, '2026-10-20'),
    ], TODAY, toMin('19:00'))
    expect(byTitle(r.plan, 'Report').date).toBe(MON)
  })

  it('unknown free time → asks for it instead of guessing', () => {
    const r = applyActions(empty(), [add('Big', 230, TODAY), add('Report', 120, MON)], TODAY, toMin('19:00'))
    expect(r.needFreeTime).toEqual([{ id: byTitle(r.plan, 'Report').id, date: SUN }])
    expect(byTitle(r.plan, 'Report').date).toBeNull()
  })

  it('weekday free time accepts "monday" and applies to that weekday', () => {
    const r = applyActions(empty(), [free('Monday', '18:00', '23:00')], TODAY, toMin('10:00'))
    expect(r.plan.availability.mon).toEqual([{ start: '18:00', end: '23:00' }])
  })
})

describe('plan_days', () => {
  it('"plan tomorrow" lays tomorrow out hour by hour inside its free time', () => {
    const r = applyActions(empty(), [
      free(SUN, '14:00', '20:00'),
      { ...add('Revise', 90), date: SUN } as Action,
      { ...add('Laundry', 45), date: SUN } as Action,
      { type: 'add_fixed', title: 'Lunch with mum', date: SUN, start: '15:00', end: '16:00' },
      { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    expect(r.plannedDays).toEqual([SUN])
    const blocks = r.plan.blocks[SUN]
    expect(blocks.find((b) => b.type === 'fixed')).toMatchObject({ start: '15:00', end: '16:00' })
    expect(blocks.every((b) => toMin(b.start) >= toMin('14:00') && toMin(b.end) <= toMin('20:00'))).toBe(true)
    expect(byTitle(r.plan, 'Revise').start).not.toBeNull()
    noOverlap(blocks)
  })

  it('two free windows: nothing is placed in the gap', () => {
    const r = applyActions(empty(), [
      { type: 'set_availability', key: SUN, windows: [{ start: '09:00', end: '10:00' }, { start: '18:00', end: '21:00' }] },
      { ...add('A', 60), date: SUN } as Action, { ...add('B', 60), date: SUN } as Action,
      { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    const starts = r.plan.blocks[SUN].filter((b) => b.type === 'task').map((b) => b.start)
    expect(starts).toEqual(['09:00', '18:00'])
  })

  it('unknown free time → reported, not invented', () => {
    const r = applyActions(empty(), [{ ...add('A', 60), date: SUN } as Action, { type: 'plan_days', dates: [SUN] }], TODAY, toMin('10:00'))
    expect(r.unknownDays).toEqual([SUN])
    expect(r.plan.blocks[SUN]).toBeUndefined()
  })
})

describe('Startly asks instead of guessing', () => {
  const ask = (prev: Plan, actions: AnyAction[], nowMin: number) => {
    const run = (extra: AnyAction[] = []) => applyActions(prev, [...actions, ...extra], TODAY, nowMin)
    return { result: run(), q: findQuestion(prev, run(), TODAY, run), run }
  }

  it('a change that pushes a planned task off the day → "That puts you until …" with Keep it / Move it', () => {
    const { plan } = applyActions(empty(), [add('Hack', 120), add('Review notes', 60)], TODAY, toMin('19:30'))
    const { q, run } = ask(plan, [{ type: 'extend_task', id: byTitle(plan, 'Hack').id, extraMin: 60 }], toMin('19:40'))
    expect(q?.blocking).toBe(true)
    expect(q?.text).toBe("That puts you until 23:45. OK, or should I move 'Review notes' to Sunday?")
    const keep = run(measureAnswer(q!.options[0].extra, TODAY, run))
    expect(byTitle(keep.plan, 'Review notes').date).toBe(TODAY)
    expect(keep.unplaced).toEqual([])
    expect(keep.plan.dayEnds).toEqual({ [TODAY]: '23:45' })
    const move = run(q!.options[1].extra)
    expect(byTitle(move.plan, 'Review notes').date).toBe(SUN)
  })

  it("a new task that doesn't fit and has no deadline → \"Sunday, or drop it?\" (not blocking)", () => {
    const { q, run } = ask(empty(), [add('Hack', 150), add('Groceries', 45)], toMin('20:00'))
    expect(q).toMatchObject({ text: "'Groceries' doesn't fit today. Sunday, or drop it?", blocking: false })
    expect(byTitle(run(q!.options[1].extra).plan, 'Groceries')).toBeUndefined()
  })

  it('no question when everything fits, or when it went to a later day by deadline', () => {
    expect(ask(empty(), [add('A', 60)], toMin('10:00')).q).toBeNull()
    expect(ask(empty(), [free('sun', '10:00', '18:00'), add('Big', 200, TODAY), add('Report', 120, MON)], toMin('19:00')).q).toBeNull()
  })

  it('"keep it" only extends today, not every day', () => {
    const r = applyActions(empty(), [{ type: 'set_day_end', date: TODAY, time: '24:30' }], TODAY, toMin('10:00'))
    expect(r.plan.dayEnds).toEqual({ [TODAY]: '24:30' })
    expect(r.plan.settings.endOfDay).toBe('23:00')
  })
})

describe('answering a question a bit later', () => {
  it('"Keep it" picked a few minutes later still keeps everything (end measured at answer time)', () => {
    const { plan } = applyActions(empty(), [add('Hack', 120), add('Review notes', 60)], TODAY, toMin('19:30'))
    const change: AnyAction[] = [{ type: 'extend_task', id: byTitle(plan, 'Hack').id, extraMin: 60 }]
    const asked = (now: number) => (extra: AnyAction[] = []) => applyActions(plan, [...change, ...extra], TODAY, now)
    const q = findQuestion(plan, asked(toMin('19:40'))(), TODAY, asked(toMin('19:40')))!
    const later = asked(toMin('19:47'))
    const r = later(measureAnswer(q.options[0].extra, TODAY, later))
    expect(r.unplaced).toEqual([])
    expect(byTitle(r.plan, 'Review notes').date).toBe(TODAY)
  })
})

describe('one question per task', () => {
  it('a task due later with unknown free time gets only "When are you free?", not "Sunday, or drop it?"', () => {
    const run = (extra: AnyAction[] = []) => applyActions(empty(), [add('Big', 230, TODAY), add('Report', 120, MON), ...extra], TODAY, toMin('19:00'))
    expect(run().needFreeTime).toHaveLength(1)
    expect(findQuestion(empty(), run(), TODAY, run)).toBeNull()
  })
})

describe('review fixes (slice 3)', () => {
  it('a task that no longer fits on a laid-out later day is reported, not lost', () => {
    const r = applyActions(empty(), [
      free(SUN, '14:00', '16:00'),
      { ...add('X1', 70), date: SUN } as Action, { ...add('X2', 70), date: SUN } as Action,
      { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    expect(r.laterUnplaced).toEqual([{ id: byTitle(r.plan, 'X2').id, date: SUN }])
  })

  it('"stay up until 1 am" after "keep it" wins over today\'s one-off end', () => {
    const { plan } = applyActions(empty(), [{ type: 'set_day_end', date: TODAY, time: '23:40' }], TODAY, toMin('19:00'))
    const r = applyActions(plan, [{ type: 'set_end_of_day', time: '01:00' }, add('Long', 300)], TODAY, toMin('19:05'))
    expect(r.plan.dayEnds).toEqual({})
    expect(byTitle(r.plan, 'Long').start).not.toBeNull()
  })

  it('a day planned in advance is redone when it arrives (its 09:00 task is not "under way" at 14:00)', () => {
    const { plan } = applyActions(empty(), [
      free(SUN, '09:00', '18:00'), { ...add('S1', 60), date: SUN } as Action, { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    expect(byTitle(plan, 'S1')).toMatchObject({ start: '09:00', preplanned: true })
    const r = applyActions(plan, [add('Mail', 15)], SUN, toMin('14:00'))
    expect(byTitle(r.plan, 'S1').start).toBe('14:00')
    expect(r.plan.blocks[SUN].every((b) => toMin(b.start) >= toMin('14:00'))).toBe(true)
  })

  it('"Drop it" on "X (cont.)" drops only that part', () => {
    const { plan } = applyActions(empty(), [add('Work', 60)], TODAY, toMin('21:00'))
    const change: AnyAction[] = [{ type: 'extend_task', id: byTitle(plan, 'Work').id, extraMin: 120 }]
    const run = (extra: AnyAction[] = []) => applyActions(plan, [...change, ...extra], TODAY, toMin('22:10'))
    const q = findQuestion(plan, run(), TODAY, run)!
    expect(q.text).toContain("'Work (cont.)' doesn't fit today")
    const dropped = run(q.options.find((o) => o.id === 'drop')!.extra)
    expect(byTitle(dropped.plan, 'Work')).toBeDefined()
    expect(dropped.plan.tasks.some((t) => t.title === 'Work (cont.)')).toBe(false)
  })

  it('"plan Sunday" with nothing on it still counts as planned; tasks added later get laid out', () => {
    const { plan } = applyActions(empty(), [free(SUN, '14:00', '18:00'), { type: 'plan_days', dates: [SUN] }], TODAY, toMin('10:00'))
    expect(plan.blocks[SUN]).toEqual([])
    const r = applyActions(plan, [{ ...add('Revise', 60), date: SUN } as Action], TODAY, toMin('10:05'))
    expect(byTitle(r.plan, 'Revise').start).toBe('14:00')
  })

  it('on the day a pre-planned day arrives, "I started S1 at 13:00" keeps 13:00', () => {
    const { plan } = applyActions(empty(), [
      free(SUN, '09:00', '18:00'), { ...add('S1', 60), date: SUN } as Action, { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    const r = applyActions(plan, [{ type: 'started_at', id: byTitle(plan, 'S1').id, start: '13:00', remainingMin: 90 }], SUN, toMin('14:00'))
    expect(byTitle(r.plan, 'S1').start).toBe('13:00')
  })

  it('a new appointment in the pre-planned morning does not split a task that never started', () => {
    const { plan } = applyActions(empty(), [
      free(SUN, '09:00', '18:00'), { ...add('S1', 60), date: SUN } as Action, { type: 'plan_days', dates: [SUN] },
    ], TODAY, toMin('10:00'))
    const r = applyActions(plan, [{ type: 'add_fixed', title: 'Dentist', date: SUN, start: '09:30', end: '10:00' }], SUN, toMin('14:00'))
    expect(r.plan.tasks.some((t) => t.title === 'S1 (cont.)')).toBe(false)
    expect(byTitle(r.plan, 'S1')).toMatchObject({ start: '14:00', durationMin: 60 })
  })

  it('no longer free on Sundays → Sunday\'s old layout goes', () => {
    const { plan } = applyActions(empty(), [free('sun', '14:00', '18:00'), { ...add('A', 60), date: SUN } as Action, { type: 'plan_days', dates: [SUN] }], TODAY, toMin('10:00'))
    expect(plan.blocks[SUN]).toBeDefined()
    const r = applyActions(plan, [{ type: 'set_availability', key: 'sunday', windows: [] }], TODAY, toMin('10:05'))
    expect(r.plan.blocks[SUN]).toBeUndefined()
  })
})
