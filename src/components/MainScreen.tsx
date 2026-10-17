import { Timetable } from './timetable/Timetable'
import { ChatDrawer } from './chat/ChatDrawer'

export function MainScreen() {
  return (
    <div className="flex min-h-0 flex-1">
      <main className="relative flex-1 overflow-y-auto px-9 py-[26px]">
        <Timetable />
      </main>
      <ChatDrawer />
    </div>
  )
}
