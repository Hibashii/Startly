import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDay, useStore } from '@/state/store'
import { clock, toMin } from '@/lib/time'
import { mondayOf, plusDays, weekOf, windowsFor } from '@/scheduler/days'
import { endOfDayFor, freeWindows } from '@/scheduler/schedule'
import { planOf } from '@/state/store'
import { useShallow } from 'zustand/react/shallow'
import { TaskCard } from './TaskCard'
import { taskTitle } from './taskTitle'
import { FixedTag } from './FixedTag'
import { useT } from '@/i18n/useT'
import { GridView } from './GridView'
import { FocusTimer } from './FocusTimer'
import { WeekView } from './WeekView'
import { WeekNav } from '../WeekStrip'
import { cn } from '@/lib/utils'
import { useSlide } from '@/lib/useSlide'
import { useSwipe } from '@/lib/useSwipe'
import { dayComplete, nowState } from '@/scheduler/now'

export function Timetable() {
  const { today, nowMin } = useDay()
  const t = useT()
  const selected = useStore((s) => s.selectedDate)
  const date = selected ?? today
  const isToday = date === today
  const isPast = date < today // read-only: what was planned, and what you checked
  const dayBlocks = useStore((s) => s.blocks[date])
  const blocks = dayBlocks ?? []
  const tasks = useStore((s) => s.tasks)
  const flash = useStore((s) => s.flash)
  const justPlanned = useStore((s) => s.justPlanned)
  const plan = useStore(useShallow((s) => planOf(s)))
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const stripOpen = useStore((s) => s.weekOpen)
  const selectDate = useStore((s) => s.selectDate)
  const goToday = useStore((s) => s.goToday)
  const shiftWeek = useStore((s) => s.shiftWeek)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  // A day at a time: the arrows by the title (when the week strip is closed), and ← → on the keyboard.
  const shiftDay = (by: -1 | 1) => selectDate(plusDays(date, by))
  useEffect(() => {
    if (view === 'week') return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable], [role=menu], [role=slider]')) return // typing, or a control that uses the arrows
      const forward = (e.key === 'ArrowRight') !== (document.documentElement.dir === 'rtl') // Arabic reads right to left
      selectDate(plusDays(useStore.getState().selectedDate ?? today, forward ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, today, selectDate])
  // A phone: swipe sideways for the next or previous day (a week, on the Week view), like a calendar app.
  const page = useRef<HTMLElement>(null)
  useSwipe(page, (by) => (view === 'week' ? shiftWeek(by) : selectDate(plusDays(useStore.getState().selectedDate ?? today, by))), view)
  // The week's day names stick right under its title bar, whose height changes on a phone (a second row, or not).
  const weekBar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = weekBar.current
    if (!bar) return
    const fit = () => page.current?.style.setProperty('--week-bar', `${bar.offsetHeight - 26}px`) // (minus the padding above it)
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(bar)
    return () => watch.disconnect()
  }, [view])

  const dayArrow = 'press grid size-8 cursor-pointer place-items-center rounded-full text-mut hover:bg-blk hover:text-ink'
  // A phone: ‹ › at the end of the second row, beside Today, like the week strip's (a swipe works too).
  const phoneArrows = (back: string, on: string, by: (n: -1 | 1) => void) => (
    <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
      {([[-1, back, ChevronLeft], [1, on, ChevronRight]] as const).map(([n, label, Icon]) => (
        <button key={n} type="button" aria-label={label} onClick={() => by(n)} className="press grid size-7 cursor-pointer place-items-center rounded-full border bg-card text-ink hover:bg-blk">
          <Icon className="size-3.5 rtl:rotate-180" />
        </button>
      ))}
    </div>
  )
  const upper = (x: string) => x.replace(/^./, (c) => c.toUpperCase())
  const title = isToday ? t('today') : date === plusDays(today, 1) ? t('tomorrow') : upper(t.fmt.dayMonth(date))
  // Just the day ("Saturday"): the date is already in the top bar. A screen reader still hears all of it.
  // (Smaller on a phone, so the view switch fits beside it.)
  const named = isToday || date === plusDays(today, 1)
  const heading = (
    <h2 className="m-0 text-[22px] font-bold tracking-[-0.03em] whitespace-nowrap sm:text-[28px]">
      {named ? title : <><span aria-hidden>{upper(t.fmt.weekday(date))}</span><span className="sr-only">{title}</span></>}
    </h2>
  )
  const work = blocks.filter((b) => b.type === 'task' || b.type === 'fixed')
  const planned = work.reduce((sum, b) => sum + toMin(b.end) - toMin(b.start), 0)
  const until = blocks.reduce((max, b) => (b.end > max ? b.end : max), '')
  const now = isToday ? nowState(blocks, tasks, nowMin) : null
  const complete = isToday && dayComplete(blocks, tasks)
  // Tasks that didn't fit anywhere are never invisible.
  const notPlaced = isPast
    ? []
    : tasks.filter((t) =>
        t.kind === 'task' && t.status === 'todo' && (isToday ? t.date === null : t.date === date && !t.start && dayBlocks !== undefined),
      )

  // A later day that isn't laid out yet: its tasks as a list, with your free time.
  const laidOut = isToday || dayBlocks !== undefined // planned (even if it's empty)
  const dayTasks = tasks
    .filter((t) => t.date === date && (isPast || t.status === 'todo'))
    .sort((a, b) => (a.start ?? '99') .localeCompare(b.start ?? '99') || a.order - b.order)
  const free = windowsFor(plan, date)
  const dayMinutes = dayTasks.reduce((sum, t) => sum + t.durationMin, 0)
  const checked = dayTasks.filter((t) => t.status === 'done').length
  const stamp = (top?: number) =>
    isPast && checked > 0 && (
      <div
        className={cn(
          'stamp pointer-events-none absolute end-6 top-6 z-[5] rounded-xl border-[3px] border-current px-4 py-1 text-[34px] font-black tracking-[0.12em] whitespace-nowrap uppercase tabular-nums',
          'max-sm:end-2 max-sm:-top-2 max-sm:rounded-lg max-sm:border-2 max-sm:px-2.5 max-sm:py-0.5 max-sm:text-[20px]', // (a phone: smaller, so the names stay readable)
          checked === dayTasks.length ? 'text-acc/70' : 'text-mut/70',
        )}
        style={top === undefined ? undefined : { top }}
      >
        {checked === dayTasks.length ? `${t('doneStamp')} ✓` : t('doneCount', { done: checked, total: dayTasks.length })}
      </div>
    )

  // The Week view: Monday to Sunday of the day you're on.
  const week = weekOf(mondayOf(date))
  const weekSlide = useSlide(week[0])
  const daySlide = useSlide(date)
  const weekMinutes = tasks.filter((t) => t.date !== null && week.includes(t.date)).reduce((sum, t) => sum + t.durationMin, 0)
  const toggle = (className?: string) => tasks.length > 0 && (
    <div className={cn('ms-auto inline-flex shrink-0 self-center rounded-full border p-0.5 text-[13px]', className)} role="group" aria-label={t('view')}>
      {(['list', 'grid', 'week'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={cn('cursor-pointer rounded-full px-3 py-1 text-mut max-sm:px-2 max-sm:text-[12.5px]', view === v && 'bg-ink font-medium text-bg')}
        >
          {t(v === 'list' ? 'viewList' : v === 'grid' ? 'viewGrid' : 'viewWeek')}
        </button>
      ))}
    </div>
  )

  if (view === 'week') {
    return (
      <section ref={page} className="mx-auto max-w-[1240px]">
        <div ref={weekBar} className="sticky -top-[26px] z-20 -mt-[26px] mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-bg pt-[26px] pb-2">
          <WeekNav className="max-sm:hidden">
            <h2 className="m-0 ms-1 text-[26px] font-bold tracking-[-0.03em] whitespace-nowrap">{t.fmt.range(week[0], week[6])}</h2>
            {weekMinutes > 0 && <p className="m-0 text-sm text-mut">{t('planned', { planned: t.fmt.duration(weekMinutes) })}</p>}
          </WeekNav>
          {/* A phone, like a day: the dates and the view switch, then the hours and Today under them (a swipe changes the week). */}
          <h2 className="m-0 text-[22px] font-bold tracking-[-0.03em] whitespace-nowrap sm:hidden">{t.fmt.range(week[0], week[6])}</h2>
          {toggle()}
          <div className="flex basis-full items-center gap-3 sm:hidden">
            <p className="m-0 min-w-0 flex-1 truncate text-sm text-mut">{weekMinutes > 0 && t('planned', { planned: t.fmt.duration(weekMinutes) })}</p>
            {selected !== null && (
              <button type="button" onClick={goToday} className="press cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium whitespace-nowrap hover:bg-blk">
                {t('today')}
              </button>
            )}
            {phoneArrows(t('prevWeek'), t('nextWeek'), shiftWeek)}
          </div>
        </div>
        <div key={week[0]} className={weekSlide}>
          <WeekView days={week} today={today} nowMin={nowMin} />
        </div>
      </section>
    )
  }

  return (
    <section ref={page} className="mx-auto max-w-[700px]">
      <div className={cn('sticky -top-[26px] z-20 -mt-[26px] mb-3.5 flex flex-wrap gap-x-3 gap-y-1 bg-bg pt-[26px] pb-2 max-sm:gap-x-2', stripOpen ? 'items-baseline' : 'items-center')}>
        {stripOpen ? (
          heading
        ) : (
          // The week strip is closed: ‹ › by the title move a day (with the strip open, it does that job).
          // The ‹ sits in the page margin, so the title still lines up with the cards below.
          // (A phone: they sit at the end of the next row instead, and a swipe does it too, like a calendar app.)
          <div className="flex items-center gap-1 sm:-ms-9">
            <button type="button" aria-label={t('prevDay')} onClick={() => shiftDay(-1)} className={cn(dayArrow, 'max-sm:hidden')}>
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            {heading}
            <button type="button" aria-label={t('nextDay')} onClick={() => shiftDay(1)} className={cn(dayArrow, 'max-sm:hidden')}>
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
          </div>
        )}
        {/* A phone: the view switch sits beside the title; the line and Today go under them. */}
        {toggle('sm:hidden')}
        {/* The line, Today and the view switch move together: short on room (a long day name, the chat open),
            they drop under the title as one row instead of squeezing into a narrow column. */}
        <div className={cn('flex min-w-[min(100%,27rem)] flex-1 gap-3', stripOpen ? 'items-baseline' : 'items-center')}>
          <p className="m-0 min-w-0 flex-1 text-sm text-mut">
            {isPast
              ? ''
              : laidOut
              ? complete
                ? t('dayComplete')
                : work.length
                  ? t('plannedUntil', { planned: t.fmt.duration(planned), until: clock(until) })
                  : t('nothingPlanned')
              : [
                  // Each range is isolated left-to-right, so "09:00–10:00" never reads backwards inside an Arabic sentence.
                  free ? t('freeTime', { windows: free.map((w) => `\u2066${clock(w.start)}–\u2060${clock(w.end)}\u2069`) }) : t('freeUnknown'),
                  dayMinutes ? t('planned', { planned: t.fmt.duration(dayMinutes) }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
          {!stripOpen && !isToday && (
            <button
              type="button"
              onClick={goToday}
              className="press cursor-pointer self-center rounded-full border px-3 py-1 text-[13px] font-medium whitespace-nowrap hover:bg-blk"
            >
              {t('today')}
            </button>
          )}
          {!stripOpen && phoneArrows(t('prevDay'), t('nextDay'), shiftDay)}
          {toggle('max-sm:hidden')}
        </div>
      </div>

      {isToday && <FocusTimer />}

      <div key={date} className={cn('relative', daySlide)}>
        {/* A day that's over: a tilted stamp says how it went (nothing checked: no stamp). You can still read everything, just not change it.
            On the hour grid it sits on the first task, not up in the empty early hours. */}
        {!(laidOut && view === 'grid') && stamp()}
        {laidOut && view === 'grid' ? (
          <GridView blocks={blocks} tasks={tasks} nowMin={isToday ? nowMin : null} now={now} stamp={stamp} />
        ) : laidOut ? (
          <ol
            className="m-0 list-none p-0"
            aria-label={isToday ? t('todaysTimetable') : t('timetableOf', { day: title })}
          >
            {blocks.map((b, i) => (
              <TaskCard
                key={`${b.taskId ?? b.type}-${b.start}`}
                block={b}
                task={b.taskId ? byId.get(b.taskId) : undefined}
                flash={!!b.taskId && flash.includes(b.taskId)}
                enterDelay={justPlanned ? i * 55 : undefined}
                now={now && now.block === b ? now : undefined}
                readOnly={isPast}
                checkable={isToday}
              />
            ))}
          </ol>
        ) : !dayTasks.length ? (
          // An empty day says so in the middle of the page, not in a corner.
          <p className="m-0 flex min-h-[45vh] items-center justify-center text-center text-[15px] text-mut">
            {t(isPast ? 'nothingThatDay' : 'laterDayEmpty')}
          </p>
        ) : (
          <>
            <ul className="m-0 list-none p-0" aria-label={t('tasksOf', { day: title })}>
              {dayTasks.map((task) => (
                <li key={task.id} className={cn('my-1.5 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-blk px-4 py-[11px]', task.status === 'done' && 'text-mut line-through')}>
                  <span className="flex items-center gap-1.5 font-medium">
                    {task.kind === 'fixed' && <span className="text-sm font-normal text-mut tabular-nums">{task.start}</span>}
                    {taskTitle(task, t)}
                    {task.kind === 'fixed' && <FixedTag className="text-mut" />}
                  </span>
                  <span className="text-[13px] text-mut">{t.fmt.duration(task.durationMin)}</span>
                </li>
              ))}
            </ul>
            {!isPast && <p className="mt-4 text-sm text-mut">{t('laterDayHint')}</p>}
          </>
        )}

        {notPlaced.length > 0 && (
          <div className="mt-7">
            <h3 className="m-0 mb-1 text-sm font-semibold text-mut">
              {isToday ? t('noFitBefore', { end: freeWindows(plan, today) ? null : clock(endOfDayFor(plan, today)) }) : t('noFitOn', { day: title })}
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
      </div>
    </section>
  )
}
