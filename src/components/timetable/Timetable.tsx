import { useStore } from '@/state/store'
import { clock, dateKey, formatDuration, toMin, useNow } from '@/lib/time'
import { TaskCard } from './TaskCard'

export function Timetable() {
  const today = dateKey(useNow())
  const blocks = useStore((s) => s.blocks[today]) ?? []
  const tasks = useStore((s) => s.tasks)
  const flash = useStore((s) => s.flash)
  const justPlanned = useStore((s) => s.justPlanned)
  const thinking = useStore((s) => s.thinking)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const planned = work.reduce((sum, b) => sum + toMin(b.end) - toMin(b.start), 0)
  const endOfDay = useStore((s) => s.settings.endOfDay)
  // Tasks that didn't fit anywhere are never invisible.
  const notPlaced = tasks.filter((t) => t.kind === 'task' && t.status === 'todo' && t.date === null)
  const until = blocks.reduce((max, b) => (b.end > max ? b.end : max), '')

  return (
    <section className="mx-auto max-w-[700px]">
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.03em]">Today</h2>
        <p className="m-0 text-sm text-mut">
          {work.length ? `${formatDuration(planned)} planned · until ${clock(until)}` : 'Nothing planned yet'}
        </p>
      </div>
      <ol className={`m-0 list-none p-0 ${thinking ? 'softened' : 'unsoftened'}`} aria-label="Today's timetable" aria-busy={thinking}>
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
      {notPlaced.length > 0 && (
        <div className="mt-7">
          <h3 className="m-0 mb-1 text-sm font-semibold text-mut">Doesn't fit before {clock(endOfDay)}</h3>
          <ul className="m-0 list-none p-0" aria-label="Doesn't fit today">
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
