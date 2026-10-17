import { Toaster } from 'sonner'
import { Timetable } from './timetable/Timetable'
import { ChatDrawer } from './chat/ChatDrawer'

export function MainScreen() {
  return (
    <div className="flex min-h-0 flex-1">
      <main className="relative flex-1 overflow-y-auto px-9 py-[26px]">
        <Timetable />
      </main>
      <ChatDrawer />
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
