import { useEffect, useRef, useSyncExternalStore } from 'react'
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
  // The main screen appears once there's a plan. Until then (the first dump, Startly's questions) it's the first screen.
  const started = useStore((s) => s.tasks.length > 0)
  // Did the plan just arrive in this visit (not a reload)? Then the chat glides to its place.
  const firstRun = useRef(!started)
  if (!started) firstRun.current = true // (again after "Start fresh")
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
    if (!started || !firstRun.current) return
    // The plan opens where it starts: today if anything is today, else its first day (on the Week view if it spans several).
    const { tasks, setView, selectDate } = useStore.getState()
    const days = [...new Set(tasks.map((x) => x.date ?? today))].sort()
    if (!days.length || days.includes(today)) return
    selectDate(days[0])
    if (days.length > 1) setView('week')
  }, [started, today])

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
        {started ? <MainScreen arriving={firstRun.current} /> : <FirstScreen />}
      </div>
    </TipProvider>
  )
}
