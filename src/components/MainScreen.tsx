import { Timetable } from './timetable/Timetable'
import { ChatDrawer } from './chat/ChatDrawer'
import { WeekStrip } from './WeekStrip'
import { Celebration } from './Celebration'
import { Cheer, WelcomeBack } from './Cheer'
import { StartlyPop, TimerBell } from './timetable/FocusTimer'
import { useStore } from '@/state/store'

export function MainScreen({ arriving }: { arriving?: boolean }) {
  // (The Week view has its own arrows and day headers: no strip on top of it.)
  const weekOpen = useStore((s) => s.weekOpen && s.view !== 'week')
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {weekOpen && <WeekStrip />}
        <main className="relative flex-1 overflow-y-auto px-9 py-[26px]">
          <Timetable />
        </main>
      </div>
      <ChatDrawer arriving={arriving} />
      <Celebration />
      <Cheer />
      <WelcomeBack />
      <TimerBell />
      <StartlyPop />
    </div>
  )
}
