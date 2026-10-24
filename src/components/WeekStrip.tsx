import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/i18n/useT'
import { useDay, useStore } from '@/state/store'
import { mondayOf, weekOf } from '@/scheduler/days'
import { cn } from '@/lib/utils'
import { useSlide } from '@/lib/useSlide'
import { FixedTag } from './timetable/FixedTag'

/** ‹ › a week at a time, and Today to come back. Shared by the week strip and the Week view. */
export function WeekNav({ children }: { children?: ReactNode }) {
  const t = useT()
  const shiftWeek = useStore((s) => s.shiftWeek)
  const goToday = useStore((s) => s.goToday)
  const away = useStore((s) => s.selectedDate !== null)
  const arrow = 'press grid size-7 cursor-pointer place-items-center rounded-full border bg-card text-ink hover:bg-blk'
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={t('prevWeek')} onClick={() => shiftWeek(-1)} className={arrow}>
          <ChevronLeft className="size-3.5 rtl:rotate-180" />
        </button>
        <button type="button" aria-label={t('nextWeek')} onClick={() => shiftWeek(1)} className={arrow}>
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </button>
      </div>
      {children}
      <button
        type="button"
        onClick={goToday}
        disabled={!away}
        className="press ms-auto cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium hover:bg-blk disabled:cursor-default disabled:opacity-40"
      >
        {t('today')}
      </button>
    </div>
  )
}

/** Monday to Sunday of the week you're looking at: how much is planned, and a Fixed tag for fixed appointments. Past days are greyed. */
export function WeekStrip() {
  const { today } = useDay()
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const selected = useStore((s) => s.selectedDate) ?? today
  const select = useStore((s) => s.selectDate)
  const days = weekOf(mondayOf(selected))
  const slide = useSlide(days[0])

  return (
    <nav aria-label={t('thisWeek')} className="week-in flex-none border-b bg-bg px-9 py-3">
      <div className="mx-auto max-w-[760px]">
        <WeekNav>
          <span className="ms-1 text-[15px] font-semibold">{t.fmt.monthYear(selected)}</span>
        </WeekNav>
        <ol key={days[0]} className={cn('m-0 mt-2.5 grid list-none grid-cols-7 gap-2 p-0', slide)}>
          {days.map((d) => {
            const past = d < today
            const onDay = past ? [] : tasks.filter((x) => x.date === d && x.status === 'todo')
            const minutes = onDay.reduce((sum, x) => sum + x.durationMin, 0)
            const pinned = onDay.some((x) => x.kind === 'fixed')
            const isSel = d === selected
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => select(d)}
                  aria-pressed={isSel}
                  aria-current={d === today ? 'date' : undefined}
                  aria-label={t('weekDay', { date: d, planned: minutes ? t.fmt.duration(minutes) : null, pinned })}
                  className={cn(
                    'press flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-2 hover:bg-blk',
                    past && 'text-mut/60',
                    isSel && 'bg-tint text-tinti hover:bg-tint',
                  )}
                >
                  <span className={cn('text-[12px] font-medium uppercase', !isSel && !past && 'text-mut')}>
                    {d === today ? t('today') : t.fmt.weekdayShort(d)}
                  </span>
                  <span className="text-[17px] font-semibold tabular-nums">{Number(d.slice(8))}</span>
                  <span className={cn('flex h-4 items-center gap-1 text-[12px] tabular-nums', !isSel && 'text-mut')}>
                    {pinned && <FixedTag />}
                    <span dir="ltr">{minutes ? t.fmt.duration(minutes) : ''}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
