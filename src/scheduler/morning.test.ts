import { describe, expect, it } from 'vitest'
import type { Task } from '@/types'
import { greeting, leftovers, morningQuestion } from './morning'
import { dayOf } from './days'

const TODAY = '2026-10-18'
const t = (id: string, date: string | null, status: Task['status'] = 'todo', kind: Task['kind'] = 'task'): Task => ({
  id, title: id, kind, durationMin: 30, priority: 'medium', deadline: null, preferredStart: null, date, start: '10:00', status, order: 0,
})

describe('morning', () => {
  it('finds only unchecked tasks from earlier days', () => {
    const tasks = [t('Groceries', '2026-10-17'), t('Done', '2026-10-17', 'done'), t('Call', '2026-10-17', 'todo', 'fixed'), t('Today', TODAY), t('Later', '2026-10-20')]
    expect(leftovers(tasks, TODAY).map((x) => x.id)).toEqual(['Groceries'])
  })

  it('"2 things from yesterday weren\'t checked … Add them to today?" with Add both / Choose / Drop them', () => {
    const q = morningQuestion([t('Groceries', '2026-10-17'), t('Job application #3', '2026-10-17')], [], TODAY)!
    expect(q.text).toBe("2 things from yesterday weren't checked: Groceries, Job application #3. Add them to today?")
    expect(q.options.map((o) => o.label)).toEqual(['Add both', 'Choose', 'Drop them'])
    expect(q.choose).toHaveLength(2)
    expect(q.blocking).toBe(false)
  })

  it('one leftover → Add it / Drop it; none → no question', () => {
    expect(morningQuestion([t('Groceries', '2026-10-15')], [], TODAY)!.text).toBe("'Groceries' from earlier wasn't checked. Add it to today?")
    expect(morningQuestion([], [], TODAY)).toBeNull()
  })

  it('greets by time of day, and says the plan is still here', () => {
    expect(greeting(8, true, 0)).toMatch(/^Good morning.*Your plan is still here\.$/)
    expect(greeting(15, false, 0)).toMatch(/afternoon.*What's on today\?/)
  })
})

describe('review fixes (slice 6)', () => {
  it('a split task is one leftover, added back whole or dropped part by part', () => {
    const essay = t('Essay', '2026-10-17')
    const cont = { ...t('Essay (cont.)', '2026-10-17'), partOf: 'Essay' }
    const q = morningQuestion([essay, cont], [essay, cont], TODAY)!
    expect(q.text).toBe("'Essay' from yesterday wasn't checked. Add it to today?")
    expect(q.options[1].extra).toEqual([{ type: 'remove_one', id: 'Essay' }, { type: 'remove_one', id: 'Essay (cont.)' }])
  })
})

describe('dayOf: a day that runs past midnight', () => {
  const plan = (endOfDay: string) => ({ tasks: [], blocks: {}, availability: {}, settings: { accent: 'iris' as const, theme: null, endOfDay } })
  it('at 00:30 with a 1 am end it is still yesterday, at "24:30"', () => {
    expect(dayOf(new Date('2026-10-18T00:30:00'), plan('25:00'))).toEqual({ today: '2026-10-17', nowMin: 24 * 60 + 30 })
  })
  it('after the day ends, or with a usual 23:00 end, it is the new day', () => {
    expect(dayOf(new Date('2026-10-18T01:10:00'), plan('25:00'))).toEqual({ today: TODAY, nowMin: 70 })
    expect(dayOf(new Date('2026-10-18T00:30:00'), plan('23:00'))).toEqual({ today: TODAY, nowMin: 30 })
  })
})
