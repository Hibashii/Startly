import { Pin } from 'lucide-react'
import type { Block, Task } from '@/types'
import type { NowState } from '@/scheduler/now'
import { clock, formatDuration, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'

const HOUR = 64 // px per hour

/** The day as an hour grid, like a calendar day view, with a line at the current time. */
export function GridView({ blocks, tasks, nowMin, now }: { blocks: Block[]; tasks: Task[]; nowMin: number | null; now: NowState }) {
  if (!blocks.length) return null
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const first = Math.min(...blocks.map((b) => toMin(b.start)), nowMin ?? Infinity)
  const last = Math.max(...blocks.map((b) => toMin(b.end)), nowMin ?? 0)
  const startH = Math.floor(first / 60)
  const endH = Math.ceil(last / 60)
  const top = (min: number) => ((min - startH * 60) / 60) * HOUR
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)

  return (
    <div className="relative mt-1 ml-14" style={{ height: (endH - startH) * HOUR }} aria-label="Hour grid" role="list">
      {hours.map((h) => (
        <div key={h} className="absolute right-0 left-0 border-t border-line/70" style={{ top: top(h * 60) }}>
          <span className="absolute -top-2.5 -left-14 w-11 text-right text-xs text-mut tabular-nums">{clock(`${String(h).padStart(2, '0')}:00`)}</span>
        </div>
      ))}

      {blocks.map((b) => {
        const task = b.taskId ? byId.get(b.taskId) : undefined
        const rest = b.type === 'lunch' || b.type === 'break'
        const isNow = now?.block === b && task?.status !== 'done'
        // True height (never taller than its time, so it can't overlap the next block); short ones get a one-line label.
        const height = Math.max(((toMin(b.end) - toMin(b.start)) / 60) * HOUR - 2, 6)
        const short = height < 30
        return (
          <div
            key={`${b.taskId ?? b.type}-${b.start}`}
            role="listitem"
            data-type={b.type}
            className={cn(
              'absolute right-0 left-0 overflow-hidden rounded-lg bg-blk px-3 py-1 text-[13px]',
              short && 'flex items-center rounded-md py-0 text-[11.5px] leading-none',
              rest && 'border border-dashed bg-transparent text-mut',
              task?.status === 'done' && 'opacity-60',
              isNow && 'bg-tint text-tinti shadow-[inset_3px_0_0_var(--acc)]',
            )}
            style={{ top: top(toMin(b.start)) + 1, height }}
          >
            <div className={cn('flex items-center gap-1.5 truncate', !rest && 'font-medium', task?.status === 'done' && 'line-through', height < 12 && 'sr-only')}>
              {rest ? (b.type === 'lunch' ? 'Lunch' : 'Break') : task?.title}
              {b.type === 'fixed' && <Pin className="size-3 shrink-0 opacity-60" aria-label="fixed appointment" />}
            </div>
            {height > 34 && (
              <div className="text-xs opacity-75 tabular-nums">
                {clock(b.start)}–{clock(b.end)}
                {!rest && ` · ${formatDuration(toMin(b.end) - toMin(b.start))}`}
              </div>
            )}
          </div>
        )
      })}

      {nowMin !== null && nowMin >= startH * 60 && nowMin <= endH * 60 && (
        <div className="pointer-events-none absolute right-0 -left-2 z-10 flex items-center" style={{ top: top(nowMin) }} aria-label="Now">
          <span className="size-2 rounded-full bg-acc" />
          <span className="h-[2px] flex-1 bg-acc" />
        </div>
      )}
    </div>
  )
}
