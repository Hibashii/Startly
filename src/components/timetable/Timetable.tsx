import { Pin } from 'lucide-react'
import { useDay, useStore } from '@/state/store'
import { clock, toMin } from '@/lib/time'
import { plusDays, windowsFor } from '@/scheduler/days'
import { endOfDayFor } from '@/scheduler/schedule'
import { planOf } from '@/state/store'
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from './TaskCard'
import { taskTitle } from './taskTitle'
import { useT } from '@/i18n/useT'
import { GridView } from './GridView'
import { cn } from '@/lib/utils'
import { dayComplete, nowState } from '@/scheduler/now'

export function Timetable() {
  const { today, nowMin } = useDay()
  const t = useT()
  const selected = useStore((s) => s.selectedDate)
  const date = !selected || selected < today ? today : selected // past days aren't viewable
  const isToday = date === today
  const dayBlocks = useStore((s) => s.blocks[date])
  const blocks = dayBlocks ?? []
  const tasks = useStore((s) => s.tasks)
  const flash = useStore((s) => s.flash)
  const justPlanned = useStore((s) => s.justPlanned)
  const thinking = useStore((s) => s.thinking)
  const plan = useStore(useShallow((s) => planOf(s)))
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const title = isToday ? t('today') : date === plusDays(today, 1) ? t('tomorrow') : t.fmt.weekday(date).replace(/^./, (c) => c.toUpperCase())
  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const planned = work.reduce((sum, b) => sum + toMin(b.end) - toMin(b.start), 0)
  const until = blocks.reduce((max, b) => (b.end > max ? b.end : max), '')
  const now = isToday ? nowState(blocks, tasks, nowMin) : null
  const complete = isToday && dayComplete(blocks, tasks)
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
            ? complete
              ? t('dayComplete')
              : work.length
                ? t('plannedUntil', { planned: t.fmt.duration(planned), until: clock(until) })
                : t('nothingPlanned')
            : [
                // Each range is isolated left-to-right, so "09:00–10:00" never reads backwards inside an Arabic sentence.
                free ? t('freeTime', { windows: free.map((w) => `\u2066${clock(w.start)}–${clock(w.end)}\u2069`) }) : t('freeUnknown'),
                dayMinutes ? t('planned', { planned: t.fmt.duration(dayMinutes) }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
        {laidOut && blocks.length > 0 && (
          <div className="ms-auto inline-flex self-center rounded-full border p-0.5 text-[13px]" role="group" aria-label={t('view')}>
            {(['list', 'grid'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn('cursor-pointer rounded-full px-3 py-1 text-mut', view === v && 'bg-ink font-medium text-bg')}
              >
                {t(v === 'list' ? 'viewList' : 'viewGrid')}
              </button>
            ))}
          </div>
        )}
      </div>

      {laidOut && view === 'grid' ? (
        <GridView blocks={blocks} tasks={tasks} nowMin={isToday ? nowMin : null} now={now} />
      ) : laidOut ? (
        <ol
          className={`m-0 list-none p-0 ${thinking ? 'softened' : 'unsoftened'}`}
          aria-label={isToday ? t('todaysTimetable') : t('timetableOf', { day: title })}
          aria-busy={thinking}
        >
          {blocks.map((b, i) => (
            <TaskCard
              key={`${b.taskId ?? b.type}-${b.start}`}
              block={b}
              task={b.taskId ? byId.get(b.taskId) : undefined}
              flash={!!b.taskId && flash.includes(b.taskId)}
              enterDelay={justPlanned ? i * 55 : undefined}
              now={now && now.block === b ? now : undefined}
            />
          ))}
        </ol>
      ) : (
        <>
          <ul className="m-0 list-none p-0" aria-label={t('tasksOf', { day: title })}>
            {dayTasks.map((task) => (
              <li key={task.id} className="my-1.5 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-blk px-4 py-[11px]">
                <span className="flex items-center gap-1.5 font-medium">
                  {task.kind === 'fixed' && <span className="text-sm font-normal text-mut tabular-nums">{task.start}</span>}
                  {taskTitle(task, t)}
                  {task.kind === 'fixed' && <Pin className="size-3.5 text-mut" aria-label={t('fixedAppointment')} />}
                </span>
                <span className="text-[13px] text-mut">{t.fmt.duration(task.durationMin)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-mut">
            {t(dayTasks.length ? 'laterDayHint' : 'laterDayEmpty')}
          </p>
        </>
      )}

      {notPlaced.length > 0 && (
        <div className="mt-7">
          <h3 className="m-0 mb-1 text-sm font-semibold text-mut">
            {isToday ? t('noFitBefore', { end: clock(endOfDayFor(plan, today)) }) : t('noFitOn', { day: title })}
          </h3>
          <ul className="m-0 list-none p-0" aria-label={isToday ? t('noFitToday') : t('noFitOn', { day: title })}>
            {notPlaced.map((task) => (
              <li key={task.id} className="my-1.5 flex items-center justify-between rounded-xl border border-dashed px-4 py-2.5 text-mut">
                <span>{taskTitle(task, t)}</span>
                <span className="text-[13px]">{t.fmt.duration(task.durationMin)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
