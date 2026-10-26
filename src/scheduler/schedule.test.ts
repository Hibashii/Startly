import { describe, expect, it } from 'vitest'
import type { Block, Plan, Task } from '@/types'
import { toMin } from '@/lib/time'
import { scheduleDay, reshuffleToday } from './schedule'
import { applyActions } from './applyActions'

const TODAY = '2026-10-17'

let n = 0
function task(title: string, durationMin: number, extra: Partial<Task> = {}): Task {
  n++
  return {
    id: `t${n}`, title, kind: 'task', durationMin, priority: 'medium', deadline: null,
    preferredStart: null, endBy: null, date: null, start: null, status: 'todo', order: n, ...extra,
  }
}
function fixed(title: string, start: string, end: string, date = TODAY): Task {
  return task(title, toMin(end) - toMin(start), { kind: 'fixed', start, date, priority: 'high' })
}
function emptyPlan(tasks: Task[]): Plan {
  return { tasks, blocks: {}, availability: {}, settings: { lang: 'en', accent: 'iris', theme: null, endOfDay: '23:00' } }
}
function day(tasks: Task[], from = '09:00', prevBlocks: Block[] = []) {
  return scheduleDay({
    date: TODAY, tasks, prevBlocks, window: { start: '00:00', end: '23:00' },
    fromMin: toMin(from), includeUnplaced: true,
  })
}
function assertNoOverlap(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start))
  for (let i = 1; i < sorted.length; i++) {
    expect(toMin(sorted[i].start), `${sorted[i - 1].start}-${sorted[i - 1].end} overlaps ${sorted[i].start}`)
      .toBeGreaterThanOrEqual(toMin(sorted[i - 1].end))
  }
}
const titleAt = (tasks: Task[], b: Block) => tasks.find((t) => t.id === b.taskId)?.title ?? b.type

describe('scheduleDay', () => {
  it('places tasks back to back with no overlaps, starting at now rounded up to 5 min', () => {
    const tasks = [task('A', 60), task('B', 30), task('C', 45)]
    const r = day(tasks, '09:02')
    expect(r.blocks[0].start).toBe('09:05')
    assertNoOverlap(r.blocks)
    expect(r.unplaced).toEqual([])
  })

  it('keeps a fixed appointment at its exact time and plans around it', () => {
    const tasks = [task('Apply', 90), task('Hackathon', 120), fixed('Interview', '11:30', '12:00')]
    const r = day(tasks, '10:00')
    const interview = r.blocks.find((b) => b.type === 'fixed')!
    expect([interview.start, interview.end]).toEqual(['11:30', '12:00'])
    assertNoOverlap(r.blocks)
  })

  it('fills a gap before a fixed block with a task that fits', () => {
    const tasks = [task('Long', 120), task('Short', 30), fixed('Call', '10:00', '10:30')]
    const r = day(tasks, '09:00')
    expect(titleAt(tasks, r.blocks[0])).toBe('Short')
    expect(r.blocks[0].start).toBe('09:00')
  })

  it('adds lunch and a break the user did not type', () => {
    const tasks = [task('Apply', 135), task('Hackathon', 120), task('Gym', 60), task('Groceries', 45)]
    const r = day(tasks, '09:00')
    expect(r.blocks.filter((b) => b.type === 'lunch')).toHaveLength(1)
    expect(r.blocks.some((b) => b.type === 'break')).toBe(true)
    const lunch = r.blocks.find((b) => b.type === 'lunch')!
    expect(toMin(lunch.start)).toBeGreaterThanOrEqual(toMin('12:30'))
    expect(toMin(lunch.end) - toMin(lunch.start)).toBe(45)
    assertNoOverlap(r.blocks)
  })

  it('puts lunch first when the day starts at 12:30', () => {
    const r = day([task('A', 60), task('B', 60)], '12:30')
    expect(r.blocks[0]).toMatchObject({ type: 'lunch', start: '12:30', end: '13:15' })
  })

  it('adds no lunch when the day starts after 14:00', () => {
    const r = day([task('A', 60)], '15:00')
    expect(r.blocks.some((b) => b.type === 'lunch')).toBe(false)
  })

  it('takes a 15 min break after about 60 min of back-to-back work', () => {
    const r = day([task('A', 30), task('B', 30), task('C', 30)], '14:00')
    expect(r.blocks.map((b) => b.type)).toEqual(['task', 'task', 'break', 'task'])
    expect(r.blocks[2]).toMatchObject({ start: '15:00', end: '15:15' })
  })

  it('your own break rule: a break between every task', () => {
    const r = scheduleDay({
      date: TODAY, tasks: [task('A', 30), task('B', 30), task('C', 30)], prevBlocks: [], window: { start: '00:00', end: '23:00' },
      fromMin: toMin('14:00'), includeUnplaced: true, breaks: { afterMin: 0, lengthMin: 10 },
    })
    expect(r.blocks.map((b) => `${b.type} ${b.start}`)).toEqual(['task 14:00', 'break 14:30', 'task 14:40', 'break 15:10', 'task 15:20'])
  })

  it('orders by deadline, then priority, then order', () => {
    const tasks = [
      task('No deadline high', 30, { priority: 'high' }),
      task('Due later', 30, { deadline: '2026-10-20' }),
      task('Due soon', 30, { deadline: '2026-10-18' }),
      task('No deadline low', 30, { priority: 'low' }),
    ]
    const r = day(tasks, '15:00')
    expect(r.blocks.filter((b) => b.type === 'task').map((b) => titleAt(tasks, b)))
      .toEqual(['Due soon', 'Due later', 'No deadline high', 'No deadline low'])
  })

  it('respects preferredStart', () => {
    const tasks = [task('Gym', 60, { preferredStart: '18:00' }), task('Read', 30)]
    const r = day(tasks, '15:00')
    expect(r.starts[tasks[0].id]).toBe('18:00')
    expect(r.starts[tasks[1].id]).toBe('15:00')
  })

  it('returns what does not fit before the end of the day as unplaced', () => {
    const tasks = [task('Big', 180), task('Small', 30)]
    const r = day(tasks, '21:00')
    expect(r.unplaced).toEqual([tasks[0].id])
    expect(r.starts[tasks[1].id]).toBe('21:00')
  })

  it('a finish-by task goes before a long task whose planned time has passed', () => {
    // Live run: jobs (planned 15:00) didn't fit before the gym, so at 18:15 it came next and pushed groceries past 20:00.
    const tasks = [
      task('Demo', 120, { rank: 0, slot: '09:50' }),
      task('Apply to 3 jobs', 135, { rank: 1, slot: '15:00' }),
      task('Gym', 60, { rank: 2, preferredStart: '17:00' }),
      task('Groceries', 45, { rank: 3, slot: '18:15', endBy: '20:00' }),
      task('Call mom', 20, { rank: 4, slot: '19:30' }),
      fixed('Team meeting', '14:00', '15:00'),
    ]
    const r = day(tasks, '09:50')
    expect(r.unplaced).toEqual([])
    expect(toMin(r.starts[tasks[3].id]) + 45).toBeLessThanOrEqual(toMin('20:00'))
    assertNoOverlap(r.blocks)
  })

  it('ignores fixed appointments on other days', () => {
    const tasks = [task('A', 60), fixed('Interview', '09:30', '10:00', '2026-10-21')]
    const r = day(tasks, '09:00')
    expect(r.blocks).toHaveLength(1)
  })
})

describe('reshuffleToday', () => {
  it('keeps done and already-started tasks and past lunch where they were', () => {
    const a = task('Done earlier', 60, { date: TODAY, start: '09:00', status: 'done' })
    const b = task('In progress', 60, { date: TODAY, start: '13:30' })
    const c = task('Later', 60, { date: TODAY, start: '15:00' })
    const plan = emptyPlan([a, b, c])
    plan.blocks[TODAY] = [{ date: TODAY, start: '12:30', end: '13:15', type: 'lunch' }]
    const { plan: next } = reshuffleToday(plan, TODAY, toMin('14:00'))
    const byId = Object.fromEntries(next.tasks.map((t) => [t.id, t]))
    expect(byId[a.id].start).toBe('09:00')
    expect(byId[b.id].start).toBe('13:30')
    expect(byId[c.id].start).toBe('14:45') // after a break: B ran an hour
    expect(next.blocks[TODAY].filter((x) => x.type === 'lunch')).toHaveLength(1)
    assertNoOverlap(next.blocks[TODAY])
  })
})

describe('review fixes', () => {
  it('leaves yesterday\'s unfinished tasks where they are until the morning question is answered', () => {
    const old = task('Unfinished', 60, { date: '2026-10-16', start: '18:00' })
    const { plan } = reshuffleToday(emptyPlan([old, task('Today', 30)]), TODAY, toMin('10:00'))
    expect(plan.tasks.find((t) => t.id === old.id)).toMatchObject({ date: '2026-10-16', start: '18:00' })
  })

  it('a late task can run past midnight (shown as 00:30 in the app)', () => {
    const late = task('Late', 60, { date: TODAY, start: '23:30' })
    const r = day([late], '23:45')
    expect(r.blocks[0]).toMatchObject({ start: '23:30', end: '24:30' })
  })

  it('places a task with a past date today and skips a past or impossible appointment', () => {
    const { plan, skipped } = applyActions(emptyPlan([]), [
      { type: 'add_task', title: 'Old date', durationMin: 30, priority: 'low', deadline: null, preferredStart: null, endBy: null, date: '2026-10-10', focus: true },
      { type: 'add_fixed', title: 'Past', date: '2026-10-10', start: '10:00', end: '11:00' },
      { type: 'add_fixed', title: 'Impossible', date: '2026-13-45', start: '10:00', end: '11:00' },
    ], TODAY, toMin('10:00'))
    expect(plan.tasks.map((t) => [t.title, t.date])).toEqual([['Old date', TODAY]])
    expect(skipped).toHaveLength(2)
  })
})

describe('applyActions (dump)', () => {
  it('turns a dump into today\'s timetable with the appointment at its time', () => {
    const { plan, applied } = applyActions(emptyPlan([]), [
      { type: 'add_task', title: 'Apply to 3 jobs', durationMin: 135, priority: 'high', deadline: null, preferredStart: null, endBy: null, date: null, focus: true },
      { type: 'add_task', title: 'Hackathon', durationMin: 120, priority: 'medium', deadline: null, preferredStart: null, endBy: null, date: null, focus: true },
      { type: 'add_task', title: 'Gym', durationMin: 60, priority: 'medium', deadline: null, preferredStart: null, endBy: null, date: null, focus: true },
      { type: 'add_task', title: 'Groceries', durationMin: 45, priority: 'medium', deadline: null, preferredStart: null, endBy: null, date: null, focus: true },
      { type: 'add_fixed', title: 'Dentist', date: TODAY, start: '15:00', end: '15:30' },
    ], TODAY, toMin('10:00'))
    expect(applied).toBe(5)
    const blocks = plan.blocks[TODAY]
    expect(blocks.find((b) => b.type === 'fixed')).toMatchObject({ start: '15:00', end: '15:30' })
    expect(blocks.some((b) => b.type === 'lunch')).toBe(true)
    expect(blocks.some((b) => b.type === 'break')).toBe(true)
    expect(plan.tasks.filter((t) => t.kind === 'task').every((t) => t.date === TODAY && t.start)).toBe(true)
    assertNoOverlap(blocks)
  })

  it('skips invalid actions and applies the valid ones', () => {
    const { applied, skipped } = applyActions(emptyPlan([]), [
      { type: 'add_fixed', title: 'Bad', date: TODAY, start: '25:00', end: '26:00' },
      { type: 'add_task', title: 'Ok', durationMin: 30, priority: 'low', deadline: null, preferredStart: null, endBy: null, date: null, focus: true },
    ], TODAY, toMin('10:00'))
    expect(applied).toBe(1)
    expect(skipped).toHaveLength(1)
  })
})
