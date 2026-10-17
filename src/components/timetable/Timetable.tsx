import { format, parseISO } from 'date-fns'
import { Pin } from 'lucide-react'
import { useStore } from '@/state/store'
import { clock, dateKey, formatDuration, toMin, useNow } from '@/lib/time'
import { plusDays, windowsFor } from '@/scheduler/days'
import { endOfDayFor } from '@/scheduler/schedule'
import { planOf } from '@/state/store'
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from './TaskCard'

export function Timetable() {
  const today = dateKey(useNow())
  const selected = useStore((s) => s.selectedDate)
  const date = selected < today ? today : selected // past days aren't viewable
  const isToday = date === today
  const dayBlocks = useStore((s) => s.blocks[date])
  const blocks = dayBlocks ?? []
  const tasks = useStore((s) => s.tasks)
  const flash = useStore((s) => s.flash)
  const justPlanned = useStore((s) => s.justPlanned)
  const thinking = useStore((s) => s.thinking)
  const plan = useStore(useShallow((s) => planOf(s)))
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const title = isToday ? 'Today' : date === plusDays(today, 1) ? 'Tomorrow' : format(parseISO(date), 'EEEE')
  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const planned = work.reduce((sum, b) => sum + toMin(b.end) - toMin(b.start), 0)
  const until = blocks.reduce((max, b) => (b.end > max ? b.end : max), '')
  // Tasks that didn't fit anywhere are never invisible.
  const notPlaced = tasks.filter((t) =>
    t.kind === 'task' && t.status === 'todo' && (isToday ? t.date === null : t.date === date && !t.start && dayBlocks !== undefined),
  )

  // A later day that isn't laid out yet: its tasks as a list, with your free time.
  const laidOut = isToday || dayBlocks !== undefined // planned (even if it's empty)
  const dayTasks = tasks
    .filter((t) => t.date === date && t.status === 'todo')
    .sort((a, b) => (a.start ?? '99') .localeCompare(b.start ?? '99') || a.order - b.order)
  const free = windowsFor(plan, date)
  const dayMinutes = dayTasks.reduce((sum, t) => sum + t.durationMin, 0)

  return (
    <section className="mx-auto max-w-[700px]">
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.03em]">{title}</h2>
        <p className="m-0 text-sm text-mut">
          {laidOut
            ? work.length
              ? `${formatDuration(planned)} planned · until ${clock(until)}`
              : 'Nothing planned yet'
            : [free ? `Free ${free.map((w) => `${clock(w.start)}–${clock(w.end)}`).join(', ')}` : 'Free time unknown', dayMinutes ? `${formatDuration(dayMinutes)} planned` : '']
                .filter(Boolean)
                .join(' · ')}
        </p>
      </div>

      {laidOut ? (
        <ol
          className={`m-0 list-none p-0 ${thinking ? 'softened' : 'unsoftened'}`}
          aria-label={isToday ? "Today's timetable" : `${title}'s timetable`}
          aria-busy={thinking}
        >
          {blocks.map((b, i) => (
            <TaskCard
              key={`${b.taskId ?? b.type}-${b.start}`}
              block={b}
              task={b.taskId ? byId.get(b.taskId) : undefined}
              flash={!!b.taskId && flash.includes(b.taskId)}
              enterDelay={justPlanned ? i * 55 : undefined}
            />
          ))}
        </ol>
      ) : (
        <>
          <ul className="m-0 list-none p-0" aria-label={`${title}'s tasks`}>
            {dayTasks.map((t) => (
              <li key={t.id} className="my-1.5 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-blk px-4 py-[11px]">
                <span className="flex items-center gap-1.5 font-medium">
                  {t.kind === 'fixed' && <span className="text-sm font-normal text-mut tabular-nums">{t.start}</span>}
                  {t.title}
                  {t.kind === 'fixed' && <Pin className="size-3.5 text-mut" aria-label="fixed appointment" />}
                </span>
                <span className="text-[13px] text-mut">{formatDuration(t.durationMin)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-mut">
            {dayTasks.length ? "I'll lay this day out hour by hour when it comes, or ask me to plan it now." : 'Nothing planned for this day yet.'}
          </p>
        </>
      )}

      {notPlaced.length > 0 && (
        <div className="mt-7">
          <h3 className="m-0 mb-1 text-sm font-semibold text-mut">
            {isToday ? `Doesn't fit before ${clock(endOfDayFor(plan, today))}` : `Doesn't fit on ${title}`}
          </h3>
          <ul className="m-0 list-none p-0" aria-label={isToday ? "Doesn't fit today" : `Doesn't fit on ${title}`}>
            {notPlaced.map((t) => (
              <li key={t.id} className="my-1.5 flex items-center justify-between rounded-xl border border-dashed px-4 py-2.5 text-mut">
                <span>{t.title}</span>
                <span className="text-[13px]">{formatDuration(t.durationMin)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
