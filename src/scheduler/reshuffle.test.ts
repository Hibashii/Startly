import { describe, expect, it } from 'vitest'
import type { Action } from '../../shared/schema'
import type { Block, Plan, Task } from '@/types'
import { toMin } from '@/lib/time'
import { applyActions } from './applyActions'
import { diffToday, toastText } from './diff'

const TODAY = '2026-10-17'
const add = (title: string, durationMin: number): Action => ({
  type: 'add_task', title, durationMin, priority: 'medium', deadline: null, preferredStart: null, date: null,
})
const empty = (): Plan => ({ tasks: [], blocks: {}, availability: {}, settings: { accent: 'iris', theme: null, endOfDay: '23:00' } })
const byTitle = (p: Plan, title: string) => p.tasks.find((t) => t.title === title)!
function noOverlap(blocks: Block[]) {
  for (let i = 1; i < blocks.length; i++) expect(toMin(blocks[i].start)).toBeGreaterThanOrEqual(toMin(blocks[i - 1].end))
}

/** The demo story: planned at 14:00, then "I only started the hackathon at 16:00, it needs 2h" at 16:05. */
function demoDay() {
  const { plan } = applyActions(empty(), [
    add('Hackathon', 120), add('Gym', 60), add('Review notes', 60),
    { type: 'add_fixed', title: 'Call with mentor', date: TODAY, start: '20:00', end: '20:30' },
  ], TODAY, toMin('14:00'))
  return plan
}

describe('reshuffling from chat', () => {
  it('demo story: started late → every later task moves, nothing overlaps, the fixed call stays', () => {
    const before = demoDay()
    expect(byTitle(before, 'Hackathon').start).toBe('14:00')
    const hack = byTitle(before, 'Hackathon').id

    const { plan } = applyActions(before, [{ type: 'started_at', id: hack, start: '16:00', remainingMin: 120 }], TODAY, toMin('16:05'))
    expect(byTitle(plan, 'Hackathon')).toMatchObject({ start: '16:00', durationMin: 120 })
    expect(toMin(byTitle(plan, 'Gym').start!)).toBeGreaterThanOrEqual(toMin('18:00'))
    expect(toMin(byTitle(plan, 'Review notes').start!)).toBeGreaterThanOrEqual(toMin('18:00'))
    expect(byTitle(plan, 'Call with mentor').start).toBe('20:00')
    noOverlap(plan.blocks[TODAY])

    const d = diffToday(before.tasks, plan.tasks, TODAY)
    expect(d.moved.map((m) => m.title)).toEqual(expect.arrayContaining(['Hackathon', 'Gym', 'Review notes']))
    expect(d.moved.find((m) => m.title === 'Call with mentor')).toBeUndefined()
    expect(toastText(d)).toBe(`↻ Reshuffled ${d.moved.length} tasks`)
  })

  it('remove closes the gap', () => {
    const before = demoDay()
    const { plan } = applyActions(before, [{ type: 'remove_task', id: byTitle(before, 'Hackathon').id }], TODAY, toMin('14:00'))
    expect(plan.tasks.find((t) => t.title === 'Hackathon')).toBeUndefined()
    expect(byTitle(plan, 'Gym').start).toBe('14:00')
    expect(toastText(diffToday(before.tasks, plan.tasks, TODAY))).toBe('✓ Removed Hackathon')
  })

  it('extend_task makes the task longer and pushes the next one', () => {
    const before = demoDay()
    const { plan } = applyActions(before, [{ type: 'extend_task', id: byTitle(before, 'Hackathon').id, extraMin: 30 }], TODAY, toMin('15:00'))
    expect(byTitle(plan, 'Hackathon')).toMatchObject({ start: '14:00', durationMin: 150 })
    expect(toMin(byTitle(plan, 'Gym').start!)).toBeGreaterThanOrEqual(toMin('16:30'))
  })

  it('"put the gym in the evening" re-places it at or after the preferred time', () => {
    const before = demoDay()
    const { plan } = applyActions(before, [{
      type: 'update_task', id: byTitle(before, 'Gym').id, title: null, durationMin: null, priority: null, deadline: null, preferredStart: '18:30',
    }], TODAY, toMin('14:00'))
    expect(toMin(byTitle(plan, 'Gym').start!)).toBeGreaterThanOrEqual(toMin('18:30'))
  })

  it('"not started yet" at 15:00 starts the task now', () => {
    const before = demoDay()
    const { plan } = applyActions(before, [{ type: 'started_at', id: byTitle(before, 'Gym').id, start: '15:00', remainingMin: null }], TODAY, toMin('15:00'))
    expect(byTitle(plan, 'Gym').start).toBe('15:00')
    noOverlap(plan.blocks[TODAY])
  })

  it('skips an unknown id and applies the rest', () => {
    const before = demoDay()
    const r = applyActions(before, [{ type: 'remove_task', id: 't999' }, add('Call the bank', 30)], TODAY, toMin('14:00'))
    expect(r.skipped).toHaveLength(1)
    expect(r.applied).toBe(1)
    expect(r.plan.tasks.some((t: Task) => t.title === 'Call the bank')).toBe(true)
  })
})

describe('review fixes (slice 2)', () => {
  const at = (p: Plan, title: string) => {
    const t = byTitle(p, title)
    return `${t.start}+${t.durationMin}`
  }
  // A 15:30–16:30 under way, B and C after it.
  function underWay() {
    const { plan } = applyActions(empty(), [add('A', 60), add('B', 60), add('C', 60)], TODAY, toMin('15:30'))
    expect(at(plan, 'A')).toBe('15:30+60')
    return plan
  }

  it('"I\'ll start B at 16:15" holds 16:15 and ends the task under way there instead of restarting it', () => {
    const before = underWay()
    const { plan } = applyActions(before, [{ type: 'started_at', id: byTitle(before, 'B').id, start: '16:15', remainingMin: null }], TODAY, toMin('16:00'))
    expect(at(plan, 'A')).toBe('15:30+45')
    expect(byTitle(plan, 'B').start).toBe('16:15')
    noOverlap(plan.blocks[TODAY])
  })

  it('a preferred time is held: a long task does not run over it', () => {
    const { plan } = applyActions(empty(), [
      add('Long', 180),
      { type: 'add_task', title: 'Gym', durationMin: 60, priority: 'medium', deadline: null, preferredStart: '17:00', date: null },
    ], TODAY, toMin('15:00'))
    expect(byTitle(plan, 'Gym').start).toBe('17:00')
    expect(toMin(byTitle(plan, 'Long').start!)).toBeGreaterThanOrEqual(toMin('18:00'))
  })

  // Demo with a meeting: Hack planned at 14:00, Call 16:30–17:00; at 16:10 "I only started Hack at 16:00, it needs 2h".
  function splitDemo() {
    const { plan: before } = applyActions(empty(), [
      add('Hack', 120), add('Gym', 60), { type: 'add_fixed', title: 'Call', date: TODAY, start: '16:30', end: '17:00' },
    ], TODAY, toMin('14:00'))
    return applyActions(before, [{ type: 'started_at', id: byTitle(before, 'Hack').id, start: '16:00', remainingMin: 120 }], TODAY, toMin('16:10')).plan
  }

  it('started late over a fixed meeting → Hack stops at the meeting and "Hack (cont.)" follows it', () => {
    const plan = splitDemo()
    expect(at(plan, 'Hack')).toBe('16:00+30')
    expect(at(plan, 'Hack (cont.)')).toBe('17:00+90')
    expect(byTitle(plan, 'Hack (cont.)').partOf).toBe(byTitle(plan, 'Hack').id)
    expect(byTitle(plan, 'Call').start).toBe('16:30')
    noOverlap(plan.blocks[TODAY])
  })

  it('the continuation keeps its time once started (no drift on the next message)', () => {
    const { plan } = applyActions(splitDemo(), [add('Mail', 15)], TODAY, toMin('17:20'))
    expect(at(plan, 'Hack (cont.)')).toBe('17:00+90')
    noOverlap(plan.blocks[TODAY])
  })

  it('a continuation that does not fit is reported as unplaced', () => {
    const p = empty()
    p.settings.endOfDay = '17:30'
    const { plan: before } = applyActions(p, [add('Hack', 120)], TODAY, toMin('15:00'))
    const r = applyActions(before, [{ type: 'add_fixed', title: 'Call', date: TODAY, start: '16:00', end: '17:20' }], TODAY, toMin('15:10'))
    expect(at(r.plan, 'Hack')).toBe('15:00+60')
    expect(r.unplaced).toEqual([byTitle(r.plan, 'Hack (cont.)').id])
  })

  it('"need more time" while the continuation runs extends the continuation', () => {
    const plan = splitDemo()
    const { plan: after } = applyActions(plan, [{ type: 'extend_task', id: byTitle(plan, 'Hack').id, extraMin: 30 }], TODAY, toMin('18:10'))
    expect(at(after, 'Hack')).toBe('16:00+30')
    expect(at(after, 'Hack (cont.)')).toBe('17:00+120')
    noOverlap(after.blocks[TODAY])
  })

  it('"need more time" on a task whose time is over continues from now; the past block stays', () => {
    const { plan: before } = applyActions(empty(), [add('A', 60), add('B', 60)], TODAY, toMin('14:00'))
    const { plan } = applyActions(before, [{ type: 'extend_task', id: byTitle(before, 'A').id, extraMin: 30 }], TODAY, toMin('15:30'))
    expect(at(plan, 'A')).toBe('14:00+60')
    expect(at(plan, 'A (cont.)')).toBe('15:30+30')
    expect(byTitle(plan, 'B').start).toBe('16:00')
    noOverlap(plan.blocks[TODAY])
  })

  it('a held time beats lunch', () => {
    const { plan } = applyActions(empty(), [
      add('Short', 30),
      { type: 'add_task', title: 'X', durationMin: 60, priority: 'medium', deadline: null, preferredStart: '13:00', date: null },
    ], TODAY, toMin('11:00'))
    expect(byTitle(plan, 'X').start).toBe('13:00')
    noOverlap(plan.blocks[TODAY])
  })

  it('switching tasks keeps the rest of the interrupted one as "(cont.)"', () => {
    const before = underWay()
    const { plan } = applyActions(before, [{ type: 'started_at', id: byTitle(before, 'B').id, start: '16:05', remainingMin: null }], TODAY, toMin('16:02'))
    expect(at(plan, 'A')).toBe('15:30+35')
    expect(byTitle(plan, 'A (cont.)').durationMin).toBe(25)
    expect(byTitle(plan, 'B').start).toBe('16:05')
    noOverlap(plan.blocks[TODAY])
  })

  it('making a past task longer never overlaps the next one: the rest goes after now', () => {
    const { plan: before } = applyActions(empty(), [add('A', 60), add('B', 60)], TODAY, toMin('14:00'))
    const { plan } = applyActions(before, [{
      type: 'update_task', id: byTitle(before, 'A').id, title: null, durationMin: 120, priority: null, deadline: null, preferredStart: null,
    }], TODAY, toMin('15:30'))
    noOverlap(plan.blocks[TODAY])
  })

  it('a held time is cleared once the task has started', () => {
    const before = underWay()
    const { plan: held } = applyActions(before, [{ type: 'started_at', id: byTitle(before, 'B').id, start: '16:15', remainingMin: null }], TODAY, toMin('16:00'))
    expect(byTitle(held, 'B').preferredStart).toBe('16:15')
    const { plan } = applyActions(held, [add('D', 30)], TODAY, toMin('16:20'))
    expect(byTitle(plan, 'B').preferredStart).toBeNull()
  })

  it('deleting a split task removes its continuation too', () => {
    const plan = splitDemo()
    const { plan: after } = applyActions(plan, [{ type: 'remove_task', id: byTitle(plan, 'Hack').id }], TODAY, toMin('16:10'))
    expect(after.tasks.some((t) => t.title.startsWith('Hack'))).toBe(false)
  })

  it('"need more time" on a split task extends the latest part, not a new continuation', () => {
    const plan = splitDemo()
    const { plan: after } = applyActions(plan, [{ type: 'extend_task', id: byTitle(plan, 'Hack').id, extraMin: 30 }], TODAY, toMin('16:10'))
    expect(after.tasks.filter((t) => t.title === 'Hack (cont.)')).toHaveLength(1)
    expect(at(after, 'Hack')).toBe('16:00+30')
    expect(at(after, 'Hack (cont.)')).toBe('17:00+120')
  })

  it('a message that changes nothing else does not shift the rest of the day', () => {
    const plan = splitDemo()
    for (const [time, extra] of [['17:20', 15], ['18:20', 5]] as const) {
      const { plan: after } = applyActions(plan, [add('Small', extra)], TODAY, toMin(time))
      const d = diffToday(plan.tasks, after.tasks, TODAY)
      expect(d.moved, `at ${time}`).toEqual([])
    }
  })

  it('"stay up until midnight" accepts 24:00 / 00:00 and fits what did not fit', () => {
    const { plan: before, unplaced } = applyActions(empty(), [add('A', 240), add('Groceries', 45)], TODAY, toMin('18:45'))
    expect(unplaced).toEqual([byTitle(before, 'Groceries').id])
    for (const time of ['24:00', '00:00']) {
      const { plan } = applyActions(before, [{ type: 'set_end_of_day', time }], TODAY, toMin('18:50'))
      expect(plan.settings.endOfDay).toBe('24:00')
      expect(byTitle(plan, 'Groceries').start).not.toBeNull()
    }
  })

  it('move_to_day: today re-places it, a later day keeps it for that day', () => {
    const before = demoDay()
    const gym = byTitle(before, 'Gym').id
    const { plan: later } = applyActions(before, [{ type: 'move_to_day', id: gym, date: '2026-10-18' }], TODAY, toMin('14:00'))
    expect(byTitle(later, 'Gym')).toMatchObject({ date: '2026-10-18', start: null })
    const { plan: back } = applyActions(later, [{ type: 'move_to_day', id: gym, date: TODAY }], TODAY, toMin('14:00'))
    expect(byTitle(back, 'Gym').date).toBe(TODAY)
  })

  it('a past break with no work before it anymore is dropped', () => {
    const before = demoDay() // Hack 14:00–16:00, break 16:00–16:15, …
    const { plan } = applyActions(before, [{ type: 'started_at', id: byTitle(before, 'Hackathon').id, start: '16:30', remainingMin: 120 }], TODAY, toMin('16:35'))
    const breaks = plan.blocks[TODAY].filter((b) => b.type === 'break')
    expect(breaks.every((b) => toMin(b.start) >= toMin('16:30'))).toBe(true)
  })
})
