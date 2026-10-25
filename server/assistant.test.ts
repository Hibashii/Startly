import { afterEach, describe, expect, it, vi } from 'vitest'
import { effortFor } from './assistant'
import type { AssistantContext } from '../shared/schema'

const context = (tasks: AssistantContext['tasks'] = []): AssistantContext => ({
  now: '2026-10-17T15:00', weekday: 'Saturday', today: '2026-10-17', tasks, availability: {},
  endOfDay: '23:00', pending: null, recentMessages: [], timetable: [], breaks: { afterMin: 60, lengthMin: 15 }, language: 'en',
})
const planned = context([{ id: 't1', title: 'Gym', kind: 'task', date: '2026-10-17', start: '18:00', durationMin: 60, status: 'todo', deadline: null, priority: 'medium', onTimetable: true }])

describe('reasoning effort', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('a first plan thinks longer', () => {
    expect(effortFor('gym', context())).toBe('medium')
  })

  it('one small change to a planned day is quick', () => {
    expect(effortFor('I need one more hour for the gym', planned)).toBe('low')
  })

  it('several changes at once to a planned day think longer', () => {
    expect(effortFor('Interview moved to 09:00 tomorrow; move gym to tomorrow after 19:00; finish prep today', planned)).toBe('medium')
  })

  it('OPENAI_REASONING_EFFORT wins', () => {
    vi.stubEnv('OPENAI_REASONING_EFFORT', 'high')
    expect(effortFor('gym', planned)).toBe('high')
  })
})
