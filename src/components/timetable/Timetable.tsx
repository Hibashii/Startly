import { useStore } from '@/state/store'
import { dateKey, formatDuration, toMin, useNow } from '@/lib/time'
import { TaskCard } from './TaskCard'

export function Timetable() {
  const today = dateKey(useNow())
  const blocks = useStore((s) => s.blocks[today]) ?? []
  const tasks = useStore((s) => s.tasks)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const planned = work.reduce((sum, b) => sum + toMin(b.end) - toMin(b.start), 0)
  const until = blocks.reduce((max, b) => (b.end > max ? b.end : max), '')

  return (
    <section className="mx-auto max-w-[700px]">
      <div className="mb-3.5 flex items-baseline gap-3">
        <h2 className="m-0 text-[28px] font-bold tracking-[-0.03em]">Today</h2>
        <p className="m-0 text-sm text-mut">
          {work.length ? `${formatDuration(planned)} planned · until ${until}` : 'Nothing planned yet'}
        </p>
      </div>
      <ol className="m-0 list-none p-0" aria-label="Today's timetable">
        {blocks.map((b) => (
          <TaskCard key={`${b.taskId ?? b.type}-${b.start}`} block={b} task={b.taskId ? byId.get(b.taskId) : undefined} />
        ))}
      </ol>
    </section>
  )
}
