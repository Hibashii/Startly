import { useState, type ReactNode } from 'react'
import { Check, Pin } from 'lucide-react'
import type { Block, Task } from '@/types'
import type { NowState } from '@/scheduler/now'
import { useStore } from '@/state/store'
import { clock, formatDuration, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'

interface Props {
  block: Block
  task?: Task
  flash?: boolean
  enterDelay?: number
  now?: NowState // set on the one card that has the Now highlight
}

export function TaskCard({ block, task, flash, enterDelay, now }: Props) {
  const toggleDone = useStore((s) => s.toggleDone)
  const quick = useStore((s) => s.quick)
  const rest = block.type === 'lunch' || block.type === 'break'
  const done = task?.status === 'done'
  const name = rest ? (block.type === 'lunch' ? 'Lunch' : 'Break') : (task?.title ?? '')
  const isNow = !!now && !done
  const asking = now?.kind === 'didYouFinish'

  return (
    <li
      data-type={block.type}
      data-now={isNow ? now.kind : undefined}
      data-flash={flash || undefined}
      className={cn(
        'group my-1.5 grid min-h-11 grid-cols-[18px_112px_1fr_auto] items-center gap-3.5 rounded-xl bg-blk px-4 py-[11px]',
        rest && 'min-h-9 border border-dashed bg-transparent py-[7px] text-mut',
        done && 'opacity-60',
        isNow && 'bg-tint py-3.5 pl-5 shadow-[inset_4px_0_0_var(--acc)]',
        flash && 'flash',
        enterDelay !== undefined && 'enter',
      )}
      style={enterDelay !== undefined ? { animationDelay: `${enterDelay}ms` } : undefined}
    >
      {rest || !task ? (
        <span />
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Done: ${task.title}`}
          onClick={() => toggleDone(task.id)}
          className={cn(
            'press grid size-[17px] cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-mut transition-colors',
            done && 'border-acc bg-acc text-accink',
          )}
        >
          {done && <Check className="size-3" strokeWidth={3} />}
        </button>
      )}

      <time data-part className={cn('text-sm whitespace-nowrap text-mut tabular-nums', isNow && 'text-tinti/80')}>
        {clock(block.start)}–{clock(block.end)}
      </time>

      <div className="min-w-0">
        <span className={cn('flex items-center gap-1.5', rest ? 'font-normal' : 'font-medium', done && 'text-mut line-through', isNow && 'text-tinti')}>
          {task && !rest ? <TaskName task={task} /> : <span data-part>{name}</span>}
          {block.type === 'fixed' && <Pin className="size-3.5 shrink-0 text-mut" aria-label="fixed appointment" />}
        </span>
        {isNow && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.07em] text-tinti uppercase">
            <span className="size-[7px] rounded-full bg-acc" aria-hidden />
            {asking ? "Did you finish?" : `Now · ${formatDuration(now.leftMin)} left`}
          </div>
        )}
      </div>

      {isNow && task && block.type === 'task' ? (
        // Quick buttons: on hover for the Now task, always shown for "Did you finish…?"
        <div className={cn('flex gap-1.5', !asking && 'hidden group-focus-within:flex group-hover:flex')}>
          {asking ? (
            <>
              <Pill onClick={() => toggleDone(task.id)} strong>✓ Done</Pill>
              <Pill onClick={() => quick(task.id, 'more')}>Need more time</Pill>
              <Pill onClick={() => quick(task.id, 'tomorrow')}>Skip to tomorrow</Pill>
            </>
          ) : (
            <>
              <Pill onClick={() => quick(task.id, 'more')}>Need more time</Pill>
              <Pill onClick={() => quick(task.id, 'notStarted')}>Not started</Pill>
              <Pill onClick={() => quick(task.id, 'tomorrow')}>→ Tomorrow</Pill>
            </>
          )}
        </div>
      ) : (
        <span data-part className="text-[13px] text-mut">{rest ? '' : formatDuration(toMin(block.end) - toMin(block.start))}</span>
      )}
    </li>
  )
}

function Pill({ children, onClick, strong }: { children: ReactNode; onClick: () => void; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press cursor-pointer rounded-full border border-tinti/45 px-[11px] py-1 text-[12.5px] whitespace-nowrap text-tinti hover:bg-tinti/10',
        strong && 'border-acc bg-acc font-semibold text-accink hover:bg-acc',
      )}
    >
      {children}
    </button>
  )
}

/** Click the name to rename it in place: Enter saves, Escape cancels. */
function TaskName({ task }: { task: Task }) {
  const rename = useStore((s) => s.rename)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.title)

  if (!editing) {
    return (
      <button
        type="button"
        data-part
        onClick={() => {
          setValue(task.title)
          setEditing(true)
        }}
        title="Click to rename"
        className="cursor-text truncate rounded text-left hover:underline hover:decoration-mut/40 hover:underline-offset-4"
      >
        {task.title}
      </button>
    )
  }
  const save = () => {
    rename(task.id, value)
    setEditing(false)
  }
  return (
    <input
      autoFocus
      aria-label={`Rename ${task.title}`}
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save()
        if (e.key === 'Escape') setEditing(false)
      }}
      onBlur={() => editing && save()}
      className="w-full rounded-md border border-acc bg-card px-1.5 py-0.5 font-medium text-ink outline-none"
    />
  )
}
