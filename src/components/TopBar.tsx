import { format } from 'date-fns'
import { Avatar } from './Avatar'
import { useStore } from '@/state/store'
import { useNow } from '@/lib/time'
import { cn } from '@/lib/utils'

export function TopBar({ main }: { main: boolean }) {
  const chatOpen = useStore((s) => s.chatOpen)
  const setChatOpen = useStore((s) => s.setChatOpen)
  const at = useNow()

  return (
    <header className="relative z-10 grid h-[60px] flex-none grid-cols-[1fr_auto_1fr] items-center border-b bg-bg px-[22px]">
      <div className="flex items-center gap-[9px] text-lg font-bold tracking-[-0.02em]">
        <Avatar />
        Startly
      </div>
      {main ? (
        <div className="flex items-baseline gap-2 rounded-[10px] px-3 py-1.5 font-semibold">
          {format(at, 'EEEE, d MMMM')}
          <small className="text-[13px] font-normal text-mut">{format(at, 'HH:mm')}</small>
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center justify-self-end gap-2.5">
        {main && (
          <button
            type="button"
            aria-pressed={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-full border bg-card py-1 pr-3.5 pl-1 text-sm font-semibold text-ink',
              chatOpen && 'border-transparent bg-tint text-tinti',
            )}
          >
            <Avatar />
            Ask Startly
          </button>
        )}
      </div>
    </header>
  )
}
