import { describe, expect, it } from 'vitest'
import type { Action } from '../../shared/schema'
import type { ChatMessage, Plan } from '@/types'
import { toMin } from '@/lib/time'
import { applyActions } from './applyActions'

const TODAY = '2026-10-17'
const add = (title: string, durationMin: number): Extract<Action, { type: 'add_task' }> => ({
  type: 'add_task', title, durationMin, priority: 'medium', deadline: null, preferredStart: null, endBy: null, date: null, focus: true,
})
const empty = (): Plan => ({ tasks: [], blocks: {}, availability: {}, settings: { lang: 'en', accent: 'iris', theme: null, endOfDay: '23:00' } })
const start = (p: Plan, title: string) => p.tasks.find((t) => t.title === title && !t.partOf)?.start
const id = (p: Plan, title: string) => p.tasks.find((t) => t.title === title)!.id

/** Planned at 08:30 like a school timetable: math in the morning, groceries before dinner, gym in the evening. */
function timetable() {
  return applyActions(
    empty(),
    [add('Math revision', 120), add('Groceries', 45), add('Gym', 60)],
    TODAY,
    toMin('08:30'),
    ['Math revision', 'Groceries', 'Gym'],
    [{ ref: 'Math revision', start: '09:00' }, { ref: 'Groceries', start: '17:00' }, { ref: 'Gym', start: '18:30' }],
  ).plan
}

describe("Startly's times (slots)", () => {
  it('puts each task at its time, and leaves the free time free', () => {
    const p = timetable()
    expect(start(p, 'Math revision')).toBe('09:00')
    expect(start(p, 'Groceries')).toBe('17:00')
    expect(start(p, 'Gym')).toBe('18:30')
  })

  it('running over only moves what overlaps: later tasks keep their times', () => {
    let p = timetable()
    p = applyActions(p, [{ type: 'extend_task', id: id(p, 'Math revision'), extraMin: 30 }], TODAY, toMin('10:30')).plan
    expect(start(p, 'Groceries')).toBe('17:00')
    expect(start(p, 'Gym')).toBe('18:30')
    // Groceries running 30 min late pushes the gym just enough, nothing else.
    p = applyActions(p, [{ type: 'started_at', id: id(p, 'Groceries'), start: '17:30', remainingMin: null }], TODAY, toMin('17:30')).plan
    expect(start(p, 'Groceries')).toBe('17:30')
    expect(toMin(start(p, 'Gym')!)).toBeGreaterThanOrEqual(toMin('18:15'))
    expect(toMin(start(p, 'Gym')!)).toBeLessThanOrEqual(toMin('18:30'))
  })

  it('a free afternoon still gets a lunch break when the day goes on after it', () => {
    const p = applyActions(
      empty(),
      [add('Groceries', 45), add('Laundry', 90), add('Side project', 120)],
      TODAY,
      toMin('09:00'),
      null,
      [{ ref: 'Groceries', start: '09:15' }, { ref: 'Laundry', start: '10:15' }, { ref: 'Side project', start: '18:00' }],
    ).plan
    expect(p.blocks[TODAY].find((b) => b.type === 'lunch')).toMatchObject({ start: '12:30', end: '13:15' })
    expect(start(p, 'Side project')).toBe('18:00')
  })

  it("lunch and breaks still come before a task Startly planned for that time", () => {
    const p = applyActions(
      empty(),
      [add('Math', 120), add('Apply to jobs', 90)],
      TODAY,
      toMin('10:00'),
      null,
      [{ ref: 'Math', start: '10:00' }, { ref: 'Apply to jobs', start: '12:00' }],
    ).plan
    const types = p.blocks[TODAY].map((b) => b.type)
    expect(types).toEqual(['task', 'break', 'task']) // (no lunch drawn after the day's last task)
    expect(start(p, 'Apply to jobs')).toBe('12:15')
  })

  it('a slot already in the past just means as soon as possible', () => {
    const p = applyActions(empty(), [add('Read', 30)], TODAY, toMin('14:00'), null, [{ ref: 'Read', start: '09:00' }]).plan
    expect(start(p, 'Read')).toBe('14:00')
  })

  it('your own "after 18:00" wins over where Startly planned it', () => {
    const p = applyActions(
      empty(),
      [{ ...add('Call grandma', 30), preferredStart: '18:00' } as Action],
      TODAY,
      toMin('09:00'),
      null,
      [{ ref: 'Call grandma', start: '10:00' }],
    ).plan
    expect(start(p, 'Call grandma')).toBe('18:00')
  })

  it('remembers what the user tells it about how they work', () => {
    const p = applyActions(empty(), [{ type: 'update_profile', focusBest: 'evening', habits: 'gym Mon/Wed/Fri 18:00', dayStart: null }], TODAY, toMin('09:00')).plan
    expect(p.settings.profile).toEqual({ focusBest: 'evening', habits: 'gym Mon/Wed/Fri 18:00' })
    const q = applyActions(p, [{ type: 'update_profile', focusBest: null, habits: null, dayStart: null }], TODAY, toMin('09:00')).plan
    expect(q.settings.profile).toEqual({ focusBest: 'evening', habits: 'gym Mon/Wed/Fri 18:00' })
  })

  it('remembers when their day usually starts, and keeps it', () => {
    const p = applyActions(empty(), [{ type: 'update_profile', focusBest: null, habits: null, dayStart: '04:00' }], TODAY, toMin('09:00')).plan
    expect(p.settings.profile?.dayStart).toBe('04:00')
    const q = applyActions(p, [{ type: 'update_profile', focusBest: 'morning', habits: null, dayStart: null }], TODAY, toMin('09:00')).plan
    expect(q.settings.profile).toEqual({ focusBest: 'morning', habits: '', dayStart: '04:00' })
  })
})

describe('planning several days', () => {
  const MON = '2026-10-19'
  const TUE = '2026-10-20'
  const week = () =>
    applyActions(
      empty(),
      [
        { type: 'set_availability', key: MON, windows: [{ start: '10:00', end: '22:00' }] },
        { type: 'set_availability', key: TUE, windows: [{ start: '10:00', end: '22:00' }] },
        { type: 'add_fixed', title: 'Dentist', date: TUE, start: '10:00', end: '11:00' },
        { ...add('Portfolio', 150), date: MON },
        { ...add('Spanish', 60), date: MON },
        { ...add('Spanish', 60), date: TUE },
        { ...add('RAG project', 150), date: TUE },
      ],
      TODAY,
      toMin('09:00'),
      null,
      [
        { ref: 'Portfolio', date: MON, start: '10:00' },
        { ref: 'Spanish', date: MON, start: '14:00' },
        { ref: 'RAG project', date: TUE, start: '11:30' },
      ],
    ).plan

  it('puts each task on its day at its time, around what is fixed', () => {
    const p = week()
    const on = (d: string) => p.blocks[d].filter((b) => b.taskId).map((b) => `${b.start} ${p.tasks.find((t) => t.id === b.taskId)!.title}`)
    expect(on(MON)).toEqual(['10:00 Portfolio', '14:00 Spanish'])
    expect(on(TUE)).toContain('10:00 Dentist')
    expect(on(TUE)).toContain('11:30 RAG project')
  })

  it('the same title on several days: each slot takes the task on its own day', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21']
    const p = applyActions(
      empty(),
      [
        ...days.map((d) => ({ type: 'set_availability' as const, key: d, windows: [{ start: '10:00', end: '22:00' }] })),
        ...days.map((d) => ({ ...add('Spanish', 60), date: d })),
      ],
      TODAY,
      toMin('09:00'),
      null,
      [{ ref: 'Spanish', date: days[0], start: '14:00' }, { ref: 'Spanish', date: days[1], start: '15:00' }, { ref: 'Spanish', date: days[2], start: '16:00' }],
    ).plan
    expect(days.map((d) => p.tasks.filter((t) => t.date === d).map((t) => t.start))).toEqual([['14:00'], ['15:00'], ['16:00']])
  })

  it('never plans a day in the past', () => {
    const p = applyActions(empty(), [add('Read', 30)], TODAY, toMin('09:00'), null, [{ ref: 'Read', date: '2026-10-10', start: '10:00' }]).plan
    expect(p.tasks[0].date).toBe(TODAY) // the past date is ignored: it stays a task for today
  })
})

describe('what Startly reads', () => {
  it('today to 4 weeks ahead, plus what is waiting; not the whole calendar', async () => {
    const { buildContext } = await import('@/lib/api')
    const task = (id: string, date: string | null, status: 'todo' | 'done' = 'todo') => ({
      id, title: id, kind: 'task' as const, durationMin: 30, priority: 'medium' as const, deadline: null, preferredStart: null, date, start: null, status, order: 0,
    })
    const plan = { ...empty(), tasks: [task('soon', '2026-10-20'), task('far', '2026-12-20'), task('old', '2026-10-01', 'done'), task('left', '2026-10-16'), task('waiting', null)] }
    const ctx = buildContext(plan, [], null, new Date(`${TODAY}T09:00:00`))
    expect(ctx.tasks.map((t) => t.id)).toEqual(['soon', 'left', 'waiting'])
  })

  it('while Startly keeps asking, the request stays in what it reads (even after 10 messages)', async () => {
    const { buildContext } = await import('@/lib/api')
    const say = (role: 'user' | 'assistant', text: string, i: number) => ({ id: String(i), role, text }) as ChatMessage
    const earlier = [say('user', 'gym at 18:00', 0), { ...say('assistant', 'Done.', 1), notes: [] }, say('assistant', 'Got it.', 2)]
    const asking = [say('user', 'organize my week: exam, gym twice, groceries', 3)]
    for (let i = 0; i < 6; i++) asking.push(say('assistant', `Question ${i}?`, 10 + 2 * i), say('user', `answer ${i}`, 11 + 2 * i))
    const ctx = buildContext(empty(), [...earlier, ...asking], null, new Date(`${TODAY}T09:00:00`))
    expect(ctx.recentMessages[0].text).toBe('organize my week: exam, gym twice, groceries')
    expect(ctx.recentMessages).toHaveLength(13)
    expect(ctx.questionsAsked).toBe(6)
    // After a reply that isn't a question, the count starts again and the usual last 10 are enough.
    const after = buildContext(empty(), [...asking, say('assistant', 'Here is your week.', 99)], null, new Date(`${TODAY}T09:00:00`))
    expect(after.questionsAsked).toBe(0)
    expect(after.recentMessages).toHaveLength(10)
  })
})

describe('slots: only real changes count (from the code review)', () => {
  const day = () =>
    applyActions(empty(), [add('Math', 60), add('Read', 30)], TODAY, toMin('09:00'), null, [
      { ref: 'Math', start: '10:00' },
      { ref: 'Read', start: '15:00' },
    ]).plan

  it('the same times sent again change nothing (so an open question stays open)', () => {
    const p = day()
    const ids = p.tasks.map((t) => t.id)
    const r = applyActions(p, [], TODAY, toMin('09:30'), null, [{ ref: ids[0], start: '10:00' }, { ref: ids[1], start: '15:00' }])
    expect(r.applied).toBe(0)
  })

  it('a task under way is never sent to another day', () => {
    const p = day()
    const math = p.tasks.find((t) => t.title === 'Math')!
    const r = applyActions(p, [], TODAY, toMin('10:30'), null, [{ ref: math.id, date: '2026-10-19', start: '10:00' }])
    expect(r.plan.tasks.find((t) => t.id === math.id)!.date).toBe(TODAY)
    expect(r.applied).toBe(0)
  })

  it("a repeated title never borrows another day's copy", () => {
    const p = applyActions(
      empty(),
      [
        { type: 'set_availability', key: '2026-10-19', windows: [{ start: '10:00', end: '22:00' }] },
        add('Spanish', 60), // today's
        { ...add('Spanish', 60), date: '2026-10-19' },
      ],
      TODAY,
      toMin('09:00'),
      null,
      [{ ref: 'Spanish', date: '2026-10-20', start: '14:00' }, { ref: 'Spanish', date: '2026-10-19', start: '11:00' }], // no Spanish on the 20th
    ).plan
    expect(p.tasks.filter((t) => t.title === 'Spanish').map((t) => t.date).sort()).toEqual([TODAY, '2026-10-19'])
    expect(p.tasks.find((t) => t.date === '2026-10-19')!.start).toBe('11:00')
  })

  it('past appointments are not sent to Startly; an unfinished task from this past week is', async () => {
    const { buildContext } = await import('@/lib/api')
    const base = { durationMin: 30, priority: 'medium' as const, deadline: null, preferredStart: null, start: '10:00', status: 'todo' as const, order: 0 }
    const plan = {
      ...empty(),
      tasks: [
        { ...base, id: 'class', title: 'class', kind: 'fixed' as const, date: '2026-10-14' },
        { ...base, id: 'essay', title: 'essay', kind: 'task' as const, date: '2026-10-15' },
        { ...base, id: 'ancient', title: 'ancient', kind: 'task' as const, date: '2026-09-01' },
      ],
    }
    expect(buildContext(plan, [], null, new Date(`${TODAY}T09:00:00`)).tasks.map((t) => t.id)).toEqual(['essay'])
  })
})

it("Startly's time that would miss a finish-by time is ignored: the task goes where it fits", () => {
  const p = applyActions(
    empty(),
    [add('Interview prep', 90), { ...add('Groceries', 45), endBy: '20:00' }, add('Hackathon', 120)],
    TODAY,
    toMin('16:30'),
    null,
    [{ ref: 'Interview prep', start: '16:30' }, { ref: 'Groceries', start: '19:30' }, { ref: 'Hackathon', start: '20:15' }],
  ).plan
  const g = p.tasks.find((t) => t.title === 'Groceries')!
  expect(g.start).not.toBeNull()
  expect(toMin(g.start!) + g.durationMin).toBeLessThanOrEqual(toMin('20:00'))
})

describe('Startly\'s times are soft (school timetable), yours are hard', () => {
  it('at 13:00, lunch first, then the task planned for now (not pushed behind the next one)', () => {
    const p = applyActions(empty(), [add('Hackathon', 120), add('Apply to 2 jobs', 90), add('Gym', 60)], TODAY, toMin('13:00'), null, [
      { ref: 'Hackathon', start: '13:00' },
      { ref: 'Apply to 2 jobs', start: '15:15' },
      { ref: 'Gym', start: '17:15' },
    ]).plan
    const order = p.blocks[TODAY].filter((b) => b.taskId).map((b) => `${b.start} ${p.tasks.find((t) => t.id === b.taskId)!.title}`)
    expect(order[0]).toBe('13:45 Hackathon') // after lunch
    expect(order[1]).toMatch(/Apply to 2 jobs$/) // just a little later than planned
    expect(order[2]).toBe('17:45 Gym') // pushed only as much as the overlap: 13:45 + 2h, break, 1h30, break
  })

  it('a task on today never slips to another day through a time alone (only "move it" does that)', () => {
    const p = applyActions(empty(), [add('Review notes', 60)], TODAY, toMin('19:30')).plan
    const id = p.tasks[0].id
    const r = applyActions(p, [], TODAY, toMin('19:40'), null, [{ ref: id, date: '2026-10-18', start: '10:00' }])
    expect(r.plan.tasks[0].date).toBe(TODAY)
  })
})

it('a second copy of a task already there that day is ignored; the same title on another day is fine', () => {
  const p = applyActions(empty(), [add('Groceries', 45)], TODAY, toMin('17:45')).plan
  const r = applyActions(p, [add('groceries', 45), { ...add('Groceries', 45), date: '2026-10-19' }], TODAY, toMin('17:47'))
  expect(r.plan.tasks.filter((t) => /groceries/i.test(t.title)).map((t) => t.date).sort()).toEqual([TODAY, '2026-10-19'])
})

it('a break never pushes a task past its finish-by time (groceries before the shop closes)', () => {
  const p = applyActions(
    empty(),
    [add('Interview prep', 90), { ...add('Groceries', 45), endBy: '20:00' }, add('Gym', 60)],
    TODAY,
    toMin('17:45'),
    null,
    [{ ref: 'Interview prep', start: '17:45' }, { ref: 'Groceries', start: '19:15' }, { ref: 'Gym', start: '20:00' }],
  ).plan
  expect(p.tasks.find((t) => t.title === 'Groceries')!.start).toBe('19:15')
})
