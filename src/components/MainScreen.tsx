import { Toaster } from 'sonner'
import { Timetable } from './timetable/Timetable'
import { ChatDrawer } from './chat/ChatDrawer'
import { WeekStrip } from './WeekStrip'
import { Celebration } from './Celebration'
import { useStore } from '@/state/store'

export function MainScreen() {
  const weekOpen = useStore((s) => s.weekOpen)
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {weekOpen && <WeekStrip />}
        <main className="relative flex-1 overflow-y-auto px-9 py-[26px]">
          <Timetable />
        </main>
      </div>
      <ChatDrawer />
      <Celebration />
      {/* The toast is a dark pill: ink background, page-colored text */}
      <Toaster
        position="bottom-center"
        duration={2600}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: 'mx-auto w-fit rounded-full bg-ink px-[18px] py-[9px] text-[13.5px] font-medium whitespace-nowrap text-bg shadow-[0_8px_24px_rgba(0,0,0,0.2)]',
          },
        }}
      />
    </div>
  )
}
