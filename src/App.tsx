import { useEffect, useSyncExternalStore } from 'react'
import { useStore } from '@/state/store'
import { TopBar } from '@/components/TopBar'
import { FirstScreen } from '@/components/FirstScreen'
import { MainScreen } from '@/components/MainScreen'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (cb: () => void) => {
  darkQuery.addEventListener('change', cb)
  return () => darkQuery.removeEventListener('change', cb)
}

export default function App() {
  const settings = useStore((s) => s.settings)
  // The main screen appears once there's a plan or Startly has answered (not while the first dump is in flight).
  const started = useStore((s) => s.tasks.length > 0 || s.chat.messages.some((m) => m.role === 'assistant'))
  // First visit follows the computer's mode until the user picks one.
  const systemDark = useSyncExternalStore(subscribe, () => darkQuery.matches)
  const theme = settings.theme ?? (systemDark ? 'dark' : 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.accent = settings.accent
  }, [theme, settings.accent])

  return (
    <div className="flex h-full flex-col">
      <TopBar main={started} theme={theme} />
      {started ? <MainScreen /> : <FirstScreen />}
    </div>
  )
}
