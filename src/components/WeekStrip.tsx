import { format, parseISO } from 'date-fns'
import { useDay, useStore } from '@/state/store'
import { formatDuration } from '@/lib/time'
import { plusDays } from '@/scheduler/days'
import { cn } from '@/lib/utils'

/** A rolling 7 days that always starts with today: how much is planned, and 📌 for fixed appointments. */
export function WeekStrip() {
  const { today } = useDay()
  const tasks = useStore((s) => s.tasks)
  const selected = useStore((s) => s.selectedDate)
  const select = useStore((s) => s.selectDate)
  const days = Array.from({ length: 7 }, (_, i) => plusDays(today, i))

  return (
    <nav aria-label="This week" className="week-in flex-none border-b bg-bg px-9 py-3">
      <ol className="mx-auto m-0 grid max-w-[760px] list-none grid-cols-7 gap-2 p-0">
        {days.map((d) => {
          const onDay = tasks.filter((t) => t.date === d && t.status === 'todo')
          const minutes = onDay.reduce((sum, t) => sum + t.durationMin, 0)
          const pinned = onDay.some((t) => t.kind === 'fixed')
          const isSel = d === (selected ?? today)
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => select(d)}
                aria-pressed={isSel}
                aria-label={`${format(parseISO(d), 'EEEE d MMMM')}: ${minutes ? formatDuration(minutes) + ' planned' : 'nothing planned'}${pinned ? ', fixed appointment' : ''}`}
                className={cn(
                  'press flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-xl border border-transparent px-1 py-2 hover:bg-blk',
                  isSel && 'border-transparent bg-tint text-tinti hover:bg-tint',
                )}
              >
                <span className={cn('text-[12px] font-medium text-mut uppercase', isSel && 'text-tinti')}>
                  {d === today ? 'Today' : format(parseISO(d), 'EEE')}
                </span>
                <span className="text-[17px] font-semibold tabular-nums">{format(parseISO(d), 'd')}</span>
                <span className={cn('h-4 text-[12px] text-mut tabular-nums', isSel && 'text-tinti')}>
                  {pinned && '📌 '}
                  {minutes ? formatDuration(minutes) : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
