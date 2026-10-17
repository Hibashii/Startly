import { describe, expect, it } from 'vitest'
import type { Block, Task } from '@/types'
import { toMin } from '@/lib/time'
import { dayComplete, nowState } from './now'

const D = '2026-10-17'
const t = (id: string, status: Task['status'] = 'todo', partOf?: string): Task => ({
  id, title: id, kind: 'task', durationMin: 60, priority: 'medium', deadline: null, preferredStart: null,
  date: D, start: null, status, order: 0, partOf,
})
const b = (start: string, end: string, type: Block['type'], taskId?: string): Block => ({ date: D, start, end, type, taskId })

describe('nowState', () => {
  const blocks = [b('14:00', '15:00', 'task', 'A'), b('15:00', '15:15', 'break'), b('15:15', '16:15', 'task', 'B')]

  it('the task happening now, with the time left', () => {
    expect(nowState(blocks, [t('A'), t('B')], toMin('14:20'))).toMatchObject({ kind: 'now', block: blocks[0], leftMin: 40 })
  })

  it('during the break after an unchecked task → "Did you finish A?"', () => {
    expect(nowState(blocks, [t('A'), t('B')], toMin('15:05'))).toMatchObject({ kind: 'didYouFinish', block: blocks[0] })
  })

  it('no question if it was checked', () => {
    expect(nowState(blocks, [t('A', 'done'), t('B')], toMin('15:05'))).toBeNull()
  })

  it('once the next task has started, it gets the Now card instead', () => {
    expect(nowState(blocks, [t('A'), t('B')], toMin('15:20'))).toMatchObject({ kind: 'now', block: blocks[2] })
  })

  it('a split task asks only on its last part', () => {
    const split = [b('14:00', '14:30', 'task', 'A'), b('14:30', '15:00', 'fixed', 'F'), b('15:00', '15:30', 'task', 'A2')]
    const tasks = [t('A'), { ...t('F'), kind: 'fixed' as const }, t('A2', 'todo', 'A')]
    expect(nowState(split, tasks, toMin('15:40'))).toMatchObject({ kind: 'didYouFinish', block: split[2] })
  })

  it('nothing before the first block', () => {
    expect(nowState(blocks, [t('A'), t('B')], toMin('13:00'))).toBeNull()
  })
})

describe('dayComplete', () => {
  it('all tasks and appointments checked (lunch and breaks don\'t count)', () => {
    const blocks = [b('14:00', '15:00', 'task', 'A'), b('15:00', '15:15', 'break')]
    expect(dayComplete(blocks, [t('A', 'done')])).toBe(true)
    expect(dayComplete(blocks, [t('A')])).toBe(false)
    expect(dayComplete([b('12:30', '13:15', 'lunch')], [])).toBe(false)
  })
})

describe('review fixes (slice 4)', () => {
  it('the day is not complete while a task waits under "Doesn\'t fit"', () => {
    const blocks = [b('14:00', '15:00', 'task', 'A')]
    expect(dayComplete(blocks, [t('A', 'done'), { ...t('Huge'), date: null }])).toBe(false)
  })
})
