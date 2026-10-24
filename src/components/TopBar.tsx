import { format } from 'date-fns'
import { useT } from '@/i18n/useT'
import { ChevronDown } from 'lucide-react'
import { Avatar } from './Avatar'
import { SettingsMenu } from './SettingsMenu'
import { useDay, useStore } from '@/state/store'
import { useNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useMedia } from '@/lib/useMedia'

export function TopBar({ main, theme }: { main: boolean; theme: 'light' | 'dark' }) {
  const chatOpen = useStore((s) => s.chatOpen)
  const unread = useStore((s) => s.unread)
  const setChatOpen = useStore((s) => s.setChatOpen)
  const weekOpen = useStore((s) => s.weekOpen)
  const setWeekOpen = useStore((s) => s.setWeekOpen)
  const at = useNow()
  const t = useT()
  // The day you're looking at (the arrows, a swipe, the week strip move it), not just the calendar's date:
  // a day that runs past midnight is still "today" until it ends. The clock shows only on today.
  const { today } = useDay()
  const shown = useStore((s) => s.selectedDate) ?? today
  const phone = useMedia('(max-width: 639px)')

  return (
    // A phone, once there's a plan: like a calendar app, the date is the title on the left and the buttons are on the right
    // (no logo: no room for it, and it does nothing).
    <header className={cn('relative z-30 grid h-[60px] flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-bg px-4 sm:px-[22px]', main && 'max-sm:flex')}>
      <div className={cn('flex items-center gap-[9px] text-lg font-bold tracking-[-0.02em]', main && 'max-sm:hidden')}>
        <Avatar />
        Startly
      </div>
      {main ? (
        <button
          type="button"
          onClick={() => setWeekOpen(!weekOpen)}
          aria-expanded={weekOpen}
          aria-label={t('weekToggle', { date: shown, open: weekOpen })}
          className="press flex min-w-0 cursor-pointer items-baseline gap-2 rounded-[10px] px-3 py-1.5 font-semibold hover:bg-blk max-sm:-ms-3 max-sm:gap-1.5 max-sm:text-[18px] max-sm:font-bold max-sm:tracking-[-0.02em]"
        >
          {/* A phone: the short date, and no clock (the phone shows the time). */}
          <span className="whitespace-nowrap">{phone ? t.fmt.dayMonthShort(shown) : t.fmt.dayMonth(shown)}</span>
          {shown === today && !phone && <small className="text-[13px] font-normal text-mut" dir="ltr">{format(at, 'HH:mm')}</small>}
          <ChevronDown className={cn('size-3.5 shrink-0 self-center text-mut transition-transform max-sm:size-4', weekOpen && 'rotate-180')} />
        </button>
      ) : (
        <div />
      )}
      <div className="flex items-center justify-self-end gap-2.5 max-sm:ms-auto max-sm:gap-2">
        <SettingsMenu theme={theme} />
        {main && (
          <button
            type="button"
            aria-pressed={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              // (A phone: just Startly's face.)
              'relative flex cursor-pointer items-center gap-2 rounded-full border bg-card py-1 pe-3.5 ps-1 text-sm font-semibold text-ink max-sm:p-1',
              chatOpen && 'border-transparent bg-tint text-tinti',
            )}
          >
            <Avatar />
            <span className="whitespace-nowrap max-sm:sr-only">{t('askStartly')}</span>
            {unread && <span data-unread className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-bg bg-acc" aria-hidden />}
          </button>
        )}
      </div>
    </header>
  )
}
