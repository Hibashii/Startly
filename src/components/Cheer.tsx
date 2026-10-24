import { useEffect, useState } from 'react'
import { useStore } from '@/state/store'
import { BACK_EVENT } from '@/lib/notify'
import { DancingAvatar } from './Avatar'
import { useT } from '@/i18n/useT'

/** After a check: a bold pill in your accent color springs up with a line that follows your progress. */
export function Cheer() {
  const cheer = useStore((s) => s.cheer)
  const t = useT()
  if (!cheer) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-40 flex justify-center" role="status" aria-live="polite">
      <div key={cheer.id} className="cheer-in flex items-center rounded-full bg-acc px-5 py-2.5 text-accink shadow-[0_12px_32px_color-mix(in_srgb,var(--acc)_45%,transparent)]">
        <span className="text-[16px] font-bold tracking-[-0.01em]">{t.text(cheer.line)}</span>
      </div>
    </div>
  )
}

/** You clicked a timer notification and came back: Startly dances a hello. */
export function WelcomeBack() {
  const t = useT()
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout>
    const onBack = () => {
      setShown(Date.now())
      clearTimeout(hide)
      hide = setTimeout(() => setShown(null), 2400)
    }
    window.addEventListener(BACK_EVENT, onBack)
    return () => {
      window.removeEventListener(BACK_EVENT, onBack)
      clearTimeout(hide)
    }
  }, [])
  if (!shown) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-40 flex justify-center" role="status" aria-live="polite">
      <div key={shown} className="cheer-in flex items-center gap-2 rounded-full bg-acc py-1.5 ps-2 pe-5 text-accink shadow-[0_12px_32px_color-mix(in_srgb,var(--acc)_45%,transparent)]">
        <DancingAvatar className="size-9" />
        <span className="text-[16px] font-bold tracking-[-0.01em]">{t('welcomeBack')}</span>
      </div>
    </div>
  )
}
