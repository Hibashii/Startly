import { useEffect, useSyncExternalStore } from 'react'
import { useDay, useStore } from '@/state/store'
import { dirOf } from '@/i18n'
import { TopBar } from '@/components/TopBar'
import { FirstScreen } from '@/components/FirstScreen'
import { MainScreen } from '@/components/MainScreen'
import { TipProvider } from '@/components/ui/tooltip'

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

  // A new day: fresh chat + greeting, on load, when the tab comes back, and when midnight passes.
  const morningReset = useStore((s) => s.morningReset)
  const { today } = useDay()
  useEffect(() => {
    morningReset()
    // Startly is waiting on a question: open the chat so it's seen.
    const { pending, setChatOpen } = useStore.getState()
    if (pending && pending.date === today) setChatOpen(true)
    const onFocus = () => morningReset()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [morningReset, today])

  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    html.dataset.accent = settings.accent
    // Language and writing direction: Arabic mirrors the whole layout right-to-left.
    html.lang = settings.lang
    html.dir = dirOf(settings.lang)
  }, [theme, settings.accent, settings.lang])

  return (
    <TipProvider delayDuration={250} skipDelayDuration={400}>
      <div className="flex h-full flex-col">
        <TopBar main={started} theme={theme} />
        {started ? <MainScreen /> : <FirstScreen />}
      </div>
    </TipProvider>
  )
}
