import type { Block, Task } from '@/types'
import { toMin } from '@/lib/time'

export const POMODORO = { focusMin: 25, breakMin: 5 }
const MIN = 60_000

export interface Timer {
  taskId: string
  startedAt: number // ms: when you pressed Start
  pausedAt?: number | null // ms: paused since (school mode: the timetable doesn't move)
  pausedMs?: number // earlier pauses, in total
}

const MIN_PAUSE_BACK = 3 // minutes: a shorter pause isn't offered back

/** What the focus panel shows right now. */
export type TimerView =
  | { kind: 'idle'; block: Block; endMs: number } // the Now task, not started on the timer yet
  | { kind: 'next'; block: Block; rest?: { block: Block; leftMs: number } } // the next task (during a break: its countdown)
  | { kind: 'focus'; block: Block; leftMs: number; totalMs: number; round?: { n: number; of: number }; pausedForMs?: number }
  | { kind: 'pomoBreak'; block: Block; leftMs: number; totalMs: number; backAtMs: number; pausedForMs?: number }
  | { kind: 'ended'; block: Block; pausedMin: number } // the block's time is over: Done, +15 min (or your pause back), Tomorrow
  | null

/**
 * The timer follows the timetable: a task's countdown runs to the end of its block, so "+15 min"
 * or a reshuffle moves it too. Pomodoro cuts the block into 25 min focus / 5 min break from when you pressed Start.
 * dayStartMs is 00:00 of the planning day (a block at "25:00" is 1 am the next morning).
 */
export function timerView(
  blocks: Block[],
  tasks: Task[],
  timer: Timer | null,
  mode: 'normal' | 'pomodoro',
  nowMs: number,
  dayStartMs: number,
  breakCountdown: boolean,
): TimerView {
  const at = (hhmm: string) => dayStartMs + toMin(hhmm) * MIN
  const todo = (b: Block) => b.type === 'task' && tasks.find((t) => t.id === b.taskId)?.status === 'todo'

  // The timer follows the whole task: "+15 min" after its time is up continues it as "X (cont.)".
  const started = timer && tasks.find((t) => t.id === timer.taskId)
  const root = started && (started.partOf ?? started.id)
  const parts = root ? blocks.filter((b) => b.type === 'task' && todo(b) && at(b.end) > timer!.startedAt && tasks.find((t) => t.id === b.taskId && (t.id === root || t.partOf === root))) : []
  const block = parts.find((b) => nowMs < at(b.end)) ?? parts[parts.length - 1]
  const running = block ? timer : null
  if (running && block) {
    const endMs = at(block.end)
    const pausedForMs = running.pausedAt ? Math.max(0, nowMs - running.pausedAt) : 0
    const pausedTotal = (running.pausedMs ?? 0) + pausedForMs
    const paused = running.pausedAt ? { pausedForMs } : {}
    if (nowMs >= endMs) {
      const m = pausedTotal / MIN
      return { kind: 'ended', block, pausedMin: m < MIN_PAUSE_BACK ? 0 : Math.max(5, Math.round(m / 5) * 5) }
    }
    const from = Math.min(running.startedAt, nowMs)
    // School mode: the bell keeps its time. A pause is time you didn't use, not time added.
    if (mode === 'normal') return { kind: 'focus', block, leftMs: endMs - nowMs, totalMs: endMs - from, ...paused }
    // Pomodoro rounds count focus time only: a pause holds the round where it was.
    const cycle = (POMODORO.focusMin + POMODORO.breakMin) * MIN
    const elapsed = Math.max(0, nowMs - from - pausedTotal)
    const realLeft = endMs - nowMs
    const i = Math.floor(elapsed / cycle)
    const inCycle = elapsed - i * cycle
    const of = Math.max(1, Math.ceil((endMs - from - pausedTotal) / cycle))
    if (inCycle < POMODORO.focusMin * MIN) {
      const total = POMODORO.focusMin * MIN
      return { kind: 'focus', block, leftMs: Math.min(total - inCycle, realLeft), totalMs: total, round: { n: i + 1, of }, ...paused }
    }
    const leftMs = Math.min(cycle - inCycle, realLeft)
    return { kind: 'pomoBreak', block, leftMs, totalMs: POMODORO.breakMin * MIN, backAtMs: nowMs + leftMs, ...paused }
  }

  const current = blocks.find((b) => at(b.start) <= nowMs && nowMs < at(b.end))
  if (current?.type === 'fixed') return null
  if (current && todo(current)) return { kind: 'idle', block: current, endMs: at(current.end) }
  const next = blocks.filter((b) => todo(b) && at(b.start) > nowMs).sort((a, b) => toMin(a.start) - toMin(b.start))[0]
  if (!next) return null
  const resting = current && (current.type === 'break' || current.type === 'lunch') && breakCountdown
  return resting ? { kind: 'next', block: next, rest: { block: current, leftMs: at(current.end) - nowMs } } : { kind: 'next', block: next }
}

/** A short name for each moment, to notice when one ends and the next begins. */
export function phaseKey(v: TimerView): string {
  if (!v) return 'none'
  const p = 'pausedForMs' in v && v.pausedForMs !== undefined ? ':p' : ''
  if (v.kind === 'focus') return `f:${v.block.taskId}:${v.round?.n ?? 0}${p}`
  if (v.kind === 'pomoBreak') return `b:${v.block.taskId}${p}`
  if (v.kind === 'ended') return `e:${v.block.taskId}`
  if (v.kind === 'next' && v.rest) return `r:${v.rest.block.start}`
  return `${v.kind}:${v.block.start}`
}

/** Ring when time moves you on: a focus round ends, a break ends, or the task's time is up. */
export function shouldRing(prev: string, next: string) {
  prev = prev.replace(/:p$/, '') // pausing or resuming isn't time moving you on
  next = next.replace(/:p$/, '')
  if (prev === next) return false
  return next.startsWith('b:') || next.startsWith('e:') || (prev.startsWith('b:') && next.startsWith('f:')) || prev.startsWith('r:')
}

/** "24:13", or "1:05:00" past an hour. */
export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
