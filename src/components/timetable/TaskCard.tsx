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
      // A wide screen: ☐ time name duration, in columns. A phone: ☐ and the name, with the time under it
      // (a break keeps one line, its time at the end), and the Now card's buttons on a row of their own.
      className={cn(
        'group my-1.5 grid min-h-11 grid-cols-[18px_1fr_auto] items-center gap-x-3 rounded-xl bg-blk px-4 py-[11px] sm:grid-cols-[18px_112px_1fr_auto] sm:gap-x-3.5',
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
        <span className="col-start-1 row-span-3 row-start-1" />
      ) : (
        // (A disabled button gets no hover, so the span carries the "why".)
        <Tip label={readOnly ? t('dayOver') : !checkable ? t('checkOnTheDay') : null}>
          <span className="col-start-1 row-span-3 row-start-1 grid sm:row-span-2">
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
                // (The ::after makes the box easy to hit with a finger: 41 px around a 17 px square.)
                'press relative grid size-[17px] cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-mut transition-colors after:absolute after:-inset-3 after:content-[""] disabled:cursor-not-allowed disabled:opacity-40',
                done && 'border-acc bg-acc text-accink disabled:opacity-100',
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} />}
            </button>
          </span>
        </Tip>
      )}

      <time
        data-part
        dir="ltr"
        className={cn(
          'text-start text-[13px] whitespace-nowrap text-mut tabular-nums sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:text-sm',
          rest ? 'col-start-3 row-start-1' : 'col-start-2 row-start-3 mt-0.5 sm:mt-0',
          isNow && 'text-tinti/80',
        )}
      >
        {clock(block.start)}–{clock(block.end)}
      </time>

      <span
        className={cn(
          'col-start-2 row-start-1 flex min-w-0 items-center gap-1.5 sm:col-start-3',
          rest ? 'font-normal' : 'font-medium',
          done && 'text-mut line-through',
          isNow && 'text-tinti',
        )}
      >
        {task && !rest && !readOnly ? <TaskName task={task} name={name} /> : <span data-part dir="auto">{name}</span>}
        {block.type === 'fixed' && <FixedTag className="no-underline" />}
      </span>
      {isNow && (
        <div className="col-start-2 row-start-2 mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.07em] text-tinti uppercase sm:col-start-3">
          <span className="size-[7px] rounded-full bg-acc" aria-hidden />
          {asking && !timed ? t('didYouFinish') : asking ? t('timesUp') : t('nowLeft', { left: t.fmt.duration(now.leftMin) })}
        </div>
      )}

      {isNow && task && block.type === 'task' && !timed ? (
        // Quick buttons: on hover for the Now task, always shown for "Did you finish…?".
        // A phone or a touch screen (no hover there): always shown, on a row of their own under the card's text.
        <div
          className={cn(
            'col-span-full row-start-4 mt-2.5 flex flex-wrap gap-1.5 sm:pointer-fine:col-span-1 sm:pointer-fine:col-start-4 sm:pointer-fine:row-span-2 sm:pointer-fine:row-start-1 sm:pointer-fine:mt-0',
            !asking && 'sm:pointer-fine:hidden sm:pointer-fine:group-focus-within:flex sm:pointer-fine:group-hover:flex',
          )}
        >
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
        <span data-part className={cn('col-start-3 row-span-3 row-start-1 text-[13px] text-mut sm:col-start-4 sm:row-span-2', rest && 'max-sm:hidden')}>
          {rest ? '' : t.fmt.duration(toMin(block.end) - toMin(block.start))}
        </span>
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
        'press cursor-pointer rounded-full border border-tinti/45 px-[11px] py-1 text-[12.5px] whitespace-nowrap text-tinti hover:bg-tinti/10 max-sm:px-2.5 max-sm:text-[12px]',
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
        dir="auto" // (an English name in Arabic is cut at its own end: "Finish the…", not "…for my project")
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
      className="w-full rounded-md border border-acc bg-card px-1.5 py-0.5 text-base font-medium text-ink outline-none sm:text-[15px]"
    />
  )
}
