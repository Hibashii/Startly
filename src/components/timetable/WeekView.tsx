import { useEffect, useRef, type CSSProperties } from 'react'
import type { Block, Task } from '@/types'
import { useStore } from '@/state/store'
import { clock, toHHMM, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import { taskTitle } from './taskTitle'
import { layoutBlocks } from './GridView'
import { Tip } from '../ui/tooltip'
import { FixedTag } from './FixedTag'
import { useMedia } from '@/lib/useMedia'

const HOUR = 48 // px per hour
const DAY_START = 7 // like the day grid: 7:00…
const DAY_END = 26 // …to 2:00 at night, wider if something sits outside

/**
 * The whole week as an hour grid, Monday to Sunday. A day laid out hour by hour shows its blocks;
 * tasks on a day that has no times yet sit in the top row. Past days are greyed; a click on a day opens it.
 */
export function WeekView({ days, today, nowMin }: { days: string[]; today: string; nowMin: number }) {
  const t = useT()
  const allBlocks = useStore((s) => s.blocks)
  const tasks = useStore((s) => s.tasks)
  const select = useStore((s) => s.selectDate)
  const setView = useStore((s) => s.setView)
  const anchor = useRef<HTMLDivElement>(null)
  const phone = useMedia('(max-width: 639px)')

  const byId = new Map(tasks.map((x) => [x.id, x]))
  // A day laid out hour by hour shows its blocks. A day that isn't yet still shows what has a time
  // (fixed appointments), and its other tasks sit in the top row.
  const blocksOf = (d: string): Block[] =>
    allBlocks[d] ??
    tasks
      .filter((x) => x.date === d && x.start)
      .map((x) => ({ date: d, start: x.start!, end: toHHMM(toMin(x.start!) + x.durationMin), type: x.kind === 'fixed' ? 'fixed' : 'task', taskId: x.id }))
  // Tasks with no time on that day: not laid out yet, or they didn't fit (today: also the ones waiting with no day).
  const untimed = (d: string): Task[] =>
    tasks.filter((x) => x.kind === 'task' && x.status === 'todo' && !x.start && (x.date === d || (d === today && x.date === null)))

  const all = days.flatMap(blocksOf)
  const startH = Math.min(DAY_START, ...all.map((b) => Math.floor(toMin(b.start) / 60)))
  const endH = Math.max(DAY_END, ...all.map((b) => Math.ceil(toMin(b.end) / 60)))
  const top = (min: number) => ((min - startH * 60) / 60) * HOUR
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)
  const height = (endH - startH) * HOUR
  const showsToday = days.includes(today)

  // Opening the week lands on the earliest thing still ahead (today on), or on now if that's earlier:
  // never on an empty morning, and never with a later day's 10:00 hidden above a 13:00 now.
  const ahead = days
    .filter((d) => d >= today)
    .flatMap(blocksOf)
    .filter((b) => b.date !== today || toMin(b.end) > nowMin)
  const firstMin = Math.min(...(ahead.length ? ahead : all).map((b) => toMin(b.start)))
  const anchorMin = showsToday ? Math.min(nowMin, firstMin) : firstMin
  const anchorY = Number.isFinite(anchorMin) ? top(anchorMin) : top(9 * 60)
  const monday = days[0]
  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'start' })
  }, [monday])

  const open = (d: string) => {
    select(d)
    setView('grid')
  }

  return (
    <div role="region" aria-label={t('weekGrid')}>
      {/* Stuck under the title bar, above the now line. The ::before fills any gap up to the title bar
          (its height changes with the language and zoom), so nothing scrolls through between them.
          A phone: the title bar has two rows, and each column is narrow (the day name over its number, smaller words). */}
      <div className="sticky top-[var(--week-bar,86px)] z-[15] sm:top-[50px] grid grid-cols-[32px_repeat(7,minmax(0,1fr))] gap-x-0.5 sm:grid-cols-[48px_repeat(7,minmax(0,1fr))] sm:gap-x-1.5 border-b bg-bg pb-2 before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-bg">

        <span />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => open(d)}
            aria-current={d === today ? 'date' : undefined}
            className={cn(
              'press flex cursor-pointer flex-col items-center justify-center rounded-lg py-1.5 hover:bg-blk sm:flex-row sm:items-baseline sm:gap-1.5',
              d < today && 'text-mut/60',
              d === today && 'bg-tint text-tinti hover:bg-tint',
            )}
          >
            <span className={cn('text-[11px] font-medium uppercase sm:text-[12px]', d >= today && d !== today && 'text-mut')}>
              {/* (A phone: one letter, like a calendar app.) */}
              {phone ? t.fmt.weekdayNarrow(d) : t.fmt.weekdayShort(d)}
            </span>
            <span className="text-[16px] font-semibold tabular-nums">{Number(d.slice(8))}</span>
          </button>
        ))}
        {days.some((d) => untimed(d).length > 0) && (
          <>
            <span className="self-center text-end text-[9.5px] leading-tight text-mut sm:text-[10.5px]">{t('noTimeYet')}</span>
            {days.map((d) => (
              <ul key={d} className="m-0 flex list-none flex-col gap-1 p-0 pt-1.5">
                {untimed(d).map((x) => (
                  <Tip key={x.id} label={taskTitle(x, t)}>
                    <li className="truncate rounded-md bg-blk px-1 py-0.5 text-[10px] font-medium sm:px-2 sm:text-[12px]">{taskTitle(x, t)}</li>
                  </Tip>
                ))}
              </ul>
            ))}
          </>
        )}
      </div>

      <div className="relative mt-2 grid grid-cols-[32px_repeat(7,minmax(0,1fr))] gap-x-0.5 sm:grid-cols-[48px_repeat(7,minmax(0,1fr))] sm:gap-x-1.5" style={{ height }}>
        <div ref={anchor} className="pointer-events-none absolute scroll-mt-[190px]" style={{ top: anchorY }} aria-hidden />
        <div className="relative">
          {hours.map((h) => (
            <span key={h} className="absolute end-1 -translate-y-1/2 text-[10px] text-mut tabular-nums sm:end-1.5 sm:text-[11px]" style={{ top: top(h * 60) }}>
              {clock(`${String(h).padStart(2, '0')}:00`)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} role="list" aria-label={t.fmt.dayMonth(d)} className={cn('relative border-s border-line/60', d < today && 'opacity-55')}>
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-line/50" style={{ top: top(h * 60) }} />
            ))}
            {layoutBlocks(blocksOf(d), top, HOUR, 20).map(({ b, y, height: h }) => {
              const task = b.taskId ? byId.get(b.taskId) : undefined
              const rest = b.type === 'lunch' || b.type === 'break'
              if (b.type === 'break') return null // too small to read in a week: the gap says it
              // Names get cut off in a narrow column: hovering shows the whole name and its time.
              const tip = (
                <>
                  <div>{rest ? t('lunch') : task && taskTitle(task, t)}</div>
                  <div className="flex items-center gap-1.5 font-normal">
                    <span className="opacity-70 tabular-nums" dir="ltr">
                      {clock(b.start)}–{clock(b.end)}
                    </span>
                    {b.type === 'fixed' && <FixedTag />}
                  </div>
                </>
              )
              return (
                <Tip key={`${b.taskId ?? b.type}-${b.start}`} label={tip}>
                  <div
                    role="listitem"
                    data-type={b.type}
                    className={cn(
                      'absolute inset-x-px z-[1] overflow-hidden rounded-md px-1 py-1 text-[10px] leading-[1.15] sm:inset-x-0.5 sm:px-1.5 sm:text-[11.5px] sm:leading-tight',
                      rest ? 'border border-dashed text-mut' : 'bg-blk',
                      b.type === 'fixed' && 'border bg-card',
                      task?.status === 'done' && 'text-mut line-through',
                    )}
                    // (A narrow screen: as many lines of the name as the block holds, at each text size.)
                    style={{ top: y, height: h, '--lines': Math.max(1, Math.floor((h - 8) / 11.5)), '--lines-sm': Math.max(1, Math.floor((h - 8) / 14.375)) } as CSSProperties}
                  >
                    {/* (A phone's or small tablet's column fits a few letters: the name wraps instead of being cut, and the time is left out.) */}
                    <div className="flex items-center gap-1 truncate font-semibold max-md:whitespace-normal max-md:[overflow-wrap:anywhere] max-sm:line-clamp-(--lines) sm:max-md:line-clamp-(--lines-sm)">
                      {rest ? t('lunch') : task && taskTitle(task, t)}
                    </div>
                    {h > 30 && (
                      // The column is narrow: a fixed appointment shows its start and the tag (the full range is in the hover label).
                      <div className="flex items-center gap-1 text-[10.5px] text-mut tabular-nums max-md:hidden">
                        <span dir="ltr">{b.type === 'fixed' ? clock(b.start) : `${clock(b.start)}–${clock(b.end)}`}</span>
                        {b.type === 'fixed' && <FixedTag className="px-1 text-[9.5px] leading-[13px]" />}
                      </div>
                    )}
                  </div>
                </Tip>
              )
            })}
            {d === today && (
              <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(nowMin) }} aria-label={t('now')}>
                <span className="-ms-1 size-2 rounded-full bg-acc" />
                <span className="h-[2px] flex-1 bg-acc" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
