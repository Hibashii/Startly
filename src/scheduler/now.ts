import type { Block, Task } from '@/types'
import { toMin } from '@/lib/time'

export type NowState =
  | { kind: 'now'; block: Block; leftMin: number } // the task happening right now
  | { kind: 'didYouFinish'; block: Block } // its time is over, it isn't checked, nothing new has started
  | null

/**
 * Which block gets the Now card:
 * - the task or appointment where start ≤ now < end;
 * - otherwise, if the most recent task whose time is over is still unchecked and no other task
 *   has started since, it keeps the highlight and asks "Did you finish …?". Ignoring it changes nothing.
 */
export function nowState(blocks: Block[], tasks: Task[], nowMin: number): NowState {
  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const current = work.find((b) => toMin(b.start) <= nowMin && nowMin < toMin(b.end))
  if (current) return { kind: 'now', block: current, leftMin: toMin(current.end) - nowMin }

  const ended = work.filter((b) => toMin(b.end) <= nowMin).sort((a, b) => toMin(b.end) - toMin(a.end))[0]
  if (!ended || ended.type !== 'task') return null
  const task = tasks.find((t) => t.id === ended.taskId)
  if (!task || task.status === 'done') return null
  // The last part of a split task is the one that asks.
  const laterPart = blocks.some((b) => b.taskId && b !== ended && toMin(b.start) >= toMin(ended.end) && tasks.find((t) => t.id === b.taskId)?.partOf === (task.partOf ?? task.id))
  if (laterPart) return null
  return { kind: 'didYouFinish', block: ended }
}

/** Every task and appointment of the day is checked (lunch and breaks don't count), and nothing is left waiting under "Doesn't fit". */
export function dayComplete(blocks: Block[], tasks: Task[]) {
  const ids = blocks.filter((b) => b.taskId).map((b) => b.taskId!)
  const waiting = tasks.some((t) => t.kind === 'task' && t.status === 'todo' && t.date === null)
  return !waiting && ids.length > 0 && ids.every((id) => tasks.find((t) => t.id === id)?.status === 'done')
}
