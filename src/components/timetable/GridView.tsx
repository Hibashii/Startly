import { useEffect, useRef } from 'react'
import type { Block, Task } from '@/types'
import type { NowState } from '@/scheduler/now'
import { clock, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import { taskTitle } from './taskTitle'
import { FixedTag } from './FixedTag'

const HOUR = 72 // px per hour
const DAY_START = 7 // the grid always shows the whole day: 7:00…
const DAY_END = 26 // …to 2:00 at night, wider if a task sits outside

/** The day as an hour grid, like a calendar day view, with a line at the current time. */
export function GridView({ blocks, tasks, nowMin, now }: { blocks: Block[]; tasks: Task[]; nowMin: number | null; now: NowState }) {
  const t = useT()
  const anchor = useRef<HTMLDivElement>(null)
  // Opening the grid lands on now (or the first task), not on an empty morning.
  // (Again for each day you open: the grid stays on screen when you switch days.)
  const day = blocks[0]?.date
  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'start' })
  }, [day])
  if (!blocks.length) return null
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const first = Math.min(...blocks.map((b) => toMin(b.start)), nowMin ?? Infinity)
  const last = Math.max(...blocks.map((b) => toMin(b.end)), nowMin ?? 0)
  const startH = Math.min(DAY_START, Math.floor(first / 60))
  const endH = Math.max(DAY_END, Math.ceil(last / 60))
  const top = (min: number) => ((min - startH * 60) / 60) * HOUR
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)
  const layout = layoutBlocks(blocks, top, HOUR)
  const bottom = layout.length ? layout[layout.length - 1].y + layout[layout.length - 1].height : -Infinity
  const gridHeight = Math.max((endH - startH) * HOUR, bottom + 4)
  // The now line follows the same layout: inside a block it sits at the right fraction, after blocks it sits below them.
  let nowY: number | null = null
  if (nowMin !== null) {
    nowY = top(nowMin)
    for (const { b, y, height } of layout) {
      const s0 = toMin(b.start)
      const e0 = toMin(b.end)
      if (s0 <= nowMin && nowMin < e0) nowY = y + ((nowMin - s0) / (e0 - s0)) * height
      else if (e0 <= nowMin) nowY = Math.max(nowY, y + height + 1)
    }
  }

  return (
    <div className="relative mt-1 ms-14" style={{ height: gridHeight }} aria-label={t('hourGrid')} role="list">
      {hours.map((h) => (
        <div key={h} className="absolute right-0 left-0 z-0 border-t border-line/70" style={{ top: top(h * 60) }}>
          <span className="absolute -top-2.5 -start-14 w-11 text-end text-xs text-mut tabular-nums">{clock(`${String(h).padStart(2, '0')}:00`)}</span>
        </div>
      ))}

      {layout.map(({ b, y, height }) => {
        const task = b.taskId ? byId.get(b.taskId) : undefined
        const rest = b.type === 'lunch' || b.type === 'break'
        const isNow = now?.block === b && task?.status !== 'done'
        const short = height < 30
        return (
          <div
            key={`${b.taskId ?? b.type}-${b.start}`}
            role="listitem"
            data-type={b.type}
            className={cn(
              'absolute right-0 left-0 z-[1] overflow-hidden rounded-lg bg-blk px-3 py-1 text-[13px]',
              short && 'flex items-center gap-2 rounded-md py-0 text-[12px] leading-none',
              rest && 'border border-dashed bg-bg text-mut',
              task?.status === 'done' && 'text-mut [&>*]:opacity-70', // faded text, solid card: hour lines stay behind
              isNow && 'bg-tint text-tinti shadow-[inset_3px_0_0_var(--acc)] rtl:shadow-[inset_-3px_0_0_var(--acc)]',
            )}
            style={{ top: y, height }}
          >
            <div className={cn('flex min-w-0 items-center gap-1.5 truncate', !rest && 'font-medium', task?.status === 'done' && 'line-through')}>
              {rest ? t(b.type === 'lunch' ? 'lunch' : 'break') : task && taskTitle(task, t)}
              {b.type === 'fixed' && <FixedTag />}
            </div>
            {short ? (
              <span className="shrink-0 text-[11px] opacity-75 tabular-nums" dir="ltr">{clock(b.start)}–{clock(b.end)}</span>
            ) : height > 34 && (
              <div className="text-xs opacity-75 tabular-nums">
                <span dir="ltr">{clock(b.start)}–{clock(b.end)}</span>
                {!rest && ` · ${t.fmt.duration(toMin(b.end) - toMin(b.start))}`}
              </div>
            )}
          </div>
        )
      })}

      <div ref={anchor} className="pointer-events-none absolute scroll-mt-[190px]" style={{ top: nowY ?? layout[0].y }} aria-hidden />

      {nowY !== null && (
        <div className="pointer-events-none absolute end-0 -start-2 z-10 flex items-center" style={{ top: nowY }} aria-label={t('now')}>
          <span className="size-2 rounded-full bg-acc" />
          <span className="h-[2px] flex-1 bg-acc" />
        </div>
      )}
    </div>
  )
}

/**
 * Where each block sits in an hour grid: at its time, and at least one readable line tall
 * (a 5-minute task too); a short one nudges the next down a little so nothing overlaps.
 */
export function layoutBlocks(blocks: Block[], top: (min: number) => number, hour: number, minH = 22) {
  let bottom = -Infinity
  return [...blocks]
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((b) => {
      const real = ((toMin(b.end) - toMin(b.start)) / 60) * hour - 2
      const y = Math.max(top(toMin(b.start)) + 1, bottom + 2)
      const rest = b.type === 'lunch' || b.type === 'break'
      const height = Math.max(real, rest ? 13 : minH) // breaks keep their real height: one small line fits
      bottom = y + height
      return { b, y, height }
    })
}
