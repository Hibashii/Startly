import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import confetti from 'canvas-confetti'
import type { Block, Task } from '@/types'
import type { NowState } from '@/scheduler/now'
import { useStore } from '@/state/store'
import { clock, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import { taskTitle } from './taskTitle'
import { Tip } from '../ui/tooltip'
import { FixedTag } from './FixedTag'

interface Props {
  block: Block
  task?: Task
  flash?: boolean
  enterDelay?: number
  now?: NowState // set on the one card that has the Now highlight
  readOnly?: boolean // a past day: shown as it was, nothing to check or rename
  checkable?: boolean // only today's tasks can be checked off (a later day: rename yes, check no)
}

export function TaskCard({ block, task, flash, enterDelay, now, readOnly, checkable = true }: Props) {
  const toggleDone = useStore((s) => s.toggleDone)
  const quick = useStore((s) => s.quick)
  // The focus timer is on this task: its panel has the buttons, the card just stays highlighted.
  const timed = useStore((s) => {
    const on = s.timer && s.tasks.find((t) => t.id === s.timer!.taskId)
    return !!on && !!task && (on.partOf ?? on.id) === (task.partOf ?? task.id)
  })
  const t = useT()
  const rest = block.type === 'lunch' || block.type === 'break'
  const done = task?.status === 'done'
  const name = rest ? t(block.type === 'lunch' ? 'lunch' : 'break') : task ? taskTitle(task, t) : ''
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
        // The Now bar sits on the starting edge (left, or right in Arabic).
        isNow && 'bg-tint py-3.5 ps-5 shadow-[inset_4px_0_0_var(--acc)] rtl:shadow-[inset_-4px_0_0_var(--acc)]',
        flash && 'flash',
        enterDelay !== undefined && 'enter',
      )}
      style={enterDelay !== undefined ? { animationDelay: `${enterDelay}ms` } : undefined}
    >
      {rest || !task ? (
        <span />
      ) : (
        // (A disabled button gets no hover, so the span carries the "why".)
        <Tip label={readOnly ? t('dayOver') : !checkable ? t('checkOnTheDay') : null}>
          <span className="grid">
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              disabled={readOnly || !checkable}
              aria-label={t('doneLabel', { title: name })}
              onClick={(e) => {
                if (!done) burst(e.currentTarget)
                toggleDone(task.id)
              }}
              className={cn(
                'press grid size-[17px] cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-mut transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                done && 'border-acc bg-acc text-accink disabled:opacity-100',
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
            </button>
          </span>
        </Tip>
      )}

      <time data-part dir="ltr" className={cn('text-start text-sm whitespace-nowrap text-mut tabular-nums', isNow && 'text-tinti/80')}>
        {clock(block.start)}–{clock(block.end)}
      </time>

      <div className="min-w-0">
        <span className={cn('flex items-center gap-1.5', rest ? 'font-normal' : 'font-medium', done && 'text-mut line-through', isNow && 'text-tinti')}>
          {task && !rest && !readOnly ? <TaskName task={task} name={name} /> : <span data-part>{name}</span>}
          {block.type === 'fixed' && <FixedTag className="no-underline" />}
        </span>
        {isNow && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.07em] text-tinti uppercase">
            <span className="size-[7px] rounded-full bg-acc" aria-hidden />
            {asking && !timed ? t('didYouFinish') : asking ? t('timesUp') : t('nowLeft', { left: t.fmt.duration(now.leftMin) })}
          </div>
        )}
      </div>

      {isNow && task && block.type === 'task' && !timed ? (
        // Quick buttons: on hover for the Now task, always shown for "Did you finish…?"
        <div className={cn('flex gap-1.5', !asking && 'hidden group-focus-within:flex group-hover:flex')}>
          {asking ? (
            <>
              <Pill onClick={() => toggleDone(task.id)} strong>{t('btnDone')}</Pill>
              <Pill onClick={() => quick(task.id, 'more')}>{t('needMoreTime')}</Pill>
              <Pill onClick={() => quick(task.id, 'tomorrow')}>{t('skipToTomorrow')}</Pill>
            </>
          ) : (
            <>
              <Pill onClick={() => quick(task.id, 'more')}>{t('needMoreTime')}</Pill>
              <Pill onClick={() => quick(task.id, 'notStarted')}>{t('notStarted')}</Pill>
              <Pill onClick={() => quick(task.id, 'tomorrow')}>{t('toTomorrow')}</Pill>
            </>
          )}
        </div>
      ) : (
        <span data-part className="text-[13px] text-mut">{rest ? '' : t.fmt.duration(toMin(block.end) - toMin(block.start))}</span>
      )}
    </li>
  )
}

/** A little burst of confetti from the checkbox you just ticked. */
function burst(el: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = el.getBoundingClientRect()
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()
  confetti({
    particleCount: 26,
    spread: 70,
    startVelocity: 22,
    gravity: 0.9,
    ticks: 90,
    scalar: 0.7,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    colors: [acc, '#f9a8d4', '#fcd34d'],
    disableForReducedMotion: true,
  })
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
function TaskName({ task, name }: { task: Task; name: string }) {
  const rename = useStore((s) => s.rename)
  const t = useT()
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
        title={t('clickToRename')}
        className="cursor-text truncate rounded text-start hover:underline hover:decoration-mut/40 hover:underline-offset-4"
      >
        {name}
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
      aria-label={t('renameLabel', { title: name })}
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
