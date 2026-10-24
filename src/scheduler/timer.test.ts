import { describe, expect, it } from 'vitest'
import type { Block, Task } from '@/types'
import { countdown, phaseKey, shouldRing, timerView, type Timer } from './timer'

const DAY = new Date('2026-10-17T00:00:00').getTime()
const at = (hhmm: string) => DAY + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000
const task = (id: string, status: Task['status'] = 'todo'): Task => ({
  id, title: id, kind: 'task', durationMin: 90, priority: 'medium', deadline: null, preferredStart: null, date: '2026-10-17', start: null, status, order: 0,
})
const blocks: Block[] = [
  { date: '2026-10-17', start: '14:00', end: '15:30', type: 'task', taskId: 'a' },
  { date: '2026-10-17', start: '15:30', end: '15:45', type: 'break' },
  { date: '2026-10-17', start: '15:45', end: '16:45', type: 'task', taskId: 'b' },
  { date: '2026-10-17', start: '17:00', end: '17:30', type: 'fixed', taskId: 'c' },
]
const tasks = [task('a'), task('b'), { ...task('c'), kind: 'fixed' as const }]
const view = (now: string, timer: Timer | null = null, mode: 'normal' | 'pomodoro' = 'normal', breaks = false, ts = tasks) =>
  timerView(blocks, ts, timer, mode, at(now), DAY, breaks)

describe('timerView', () => {
  it('offers Start on the Now task, and Start now on the next one between tasks', () => {
    expect(view('14:10')).toMatchObject({ kind: 'idle', block: { taskId: 'a' } })
    expect(view('15:35')).toMatchObject({ kind: 'next', block: { taskId: 'b' } })
    expect(view('15:35')).not.toHaveProperty('rest')
    expect(view('17:10')).toBeNull() // an appointment: no timer
  })

  it('counts a break down once you have used the timer today', () => {
    expect(view('15:35', null, 'normal', true)).toMatchObject({ kind: 'next', rest: { leftMs: 10 * 60_000 } })
  })

  it('runs a normal countdown to the end of the block, then asks', () => {
    const timer = { taskId: 'a', startedAt: at('14:00') }
    expect(view('15:00', timer)).toMatchObject({ kind: 'focus', leftMs: 30 * 60_000, totalMs: 90 * 60_000 })
    expect(view('15:30', timer)).toMatchObject({ kind: 'ended', block: { taskId: 'a' } })
  })

  it('cuts the block into 25 min focus and 5 min breaks with Pomodoro', () => {
    const timer = { taskId: 'a', startedAt: at('14:00') }
    expect(view('14:10', timer, 'pomodoro')).toMatchObject({ kind: 'focus', leftMs: 15 * 60_000, round: { n: 1, of: 3 } })
    expect(view('14:27', timer, 'pomodoro')).toMatchObject({ kind: 'pomoBreak', leftMs: 3 * 60_000, backAtMs: at('14:30') })
    expect(view('15:10', timer, 'pomodoro')).toMatchObject({ kind: 'focus', round: { n: 3, of: 3 } })
    expect(view('15:30', timer, 'pomodoro')).toMatchObject({ kind: 'ended' })
  })

  it('school mode: a pause moves nothing, the bell keeps its time, and the pause is offered back at the end', () => {
    const timer = { taskId: 'a', startedAt: at('14:00'), pausedAt: at('14:30') }
    expect(view('14:42', timer)).toMatchObject({ kind: 'focus', leftMs: 48 * 60_000, pausedForMs: 12 * 60_000 })
    const resumed = { taskId: 'a', startedAt: at('14:00'), pausedAt: null, pausedMs: 12 * 60_000 }
    expect(view('15:30', resumed)).toMatchObject({ kind: 'ended', pausedMin: 10 })
    expect(view('15:30', { ...resumed, pausedMs: 2 * 60_000 })).toMatchObject({ kind: 'ended', pausedMin: 0 }) // too short to offer
  })

  it('a pause holds the Pomodoro round where it was', () => {
    const timer = { taskId: 'a', startedAt: at('14:00'), pausedAt: at('14:10') }
    expect(view('14:20', timer, 'pomodoro')).toMatchObject({ kind: 'focus', leftMs: 15 * 60_000, round: { n: 1 } })
    const resumed = { taskId: 'a', startedAt: at('14:00'), pausedAt: null, pausedMs: 10 * 60_000 }
    expect(view('14:34', resumed, 'pomodoro')).toMatchObject({ kind: 'focus', leftMs: 60_000 }) // 24 min of focus so far
  })

  it('forgets the timer once its task is checked', () => {
    const timer = { taskId: 'a', startedAt: at('14:00') }
    expect(view('14:10', timer, 'normal', false, [task('a', 'done'), task('b')])).toMatchObject({ kind: 'next', block: { taskId: 'b' } })
  })
})

describe('the bell', () => {
  it('rings when a focus round, a break or the task time ends, not when you start', () => {
    const timer = { taskId: 'a', startedAt: at('14:00') }
    const k = (now: string, mode: 'normal' | 'pomodoro' = 'pomodoro') => phaseKey(view(now, timer, mode))
    expect(shouldRing(k('14:20'), k('14:26'))).toBe(true) // break starts
    expect(shouldRing(k('14:26'), k('14:31'))).toBe(true) // back to focus
    expect(shouldRing(k('15:20', 'normal'), k('15:31', 'normal'))).toBe(true) // time's up
    expect(shouldRing(phaseKey(view('14:10')), k('14:10', 'normal'))).toBe(false) // pressing Start
    expect(shouldRing(phaseKey(view('15:40', null, 'normal', true)), phaseKey(view('15:46', null, 'normal', true)))).toBe(true) // break over
  })

  it('formats the countdown', () => {
    expect(countdown(24 * 60_000 + 13_000)).toBe('24:13')
    expect(countdown(65 * 60_000)).toBe('1:05:00')
    expect(countdown(-5)).toBe('0:00')
  })

  it('pausing and resuming never rings', () => {
    expect(shouldRing('f:a:1', 'f:a:1:p')).toBe(false)
    expect(shouldRing('b:a:p', 'b:a')).toBe(false)
  })
})
