import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { useStore } from '@/state/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Avatar } from './Avatar'
import { useT } from '@/i18n/useT'

/** Every task of the day checked: confetti falls, and a warm message with a discipline quote. */
export function Celebration() {
  const celebration = useStore((s) => s.celebration)
  const close = useStore((s) => s.closeCelebration)
  const t = useT()

  useEffect(() => {
    if (!celebration || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#5b5bd6'
    const colors = [accent, '#f9a8d4', '#fcd34d', '#86efac', '#93c5fd']
    // A real finale: a burst in the middle, then both sides keep firing for a moment.
    confetti({ particleCount: 160, spread: 90, startVelocity: 45, origin: { y: 0.35 }, colors, disableForReducedMotion: true })
    const end = Date.now() + 1600
    let frame = 0
    const sides = () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true })
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true })
      if (Date.now() < end) frame = requestAnimationFrame(sides)
    }
    frame = requestAnimationFrame(sides)
    return () => cancelAnimationFrame(frame)
  }, [celebration])

  return (
    <Dialog open={!!celebration} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="max-w-[420px] rounded-[24px] border bg-card p-8 text-center text-ink">
        <Avatar className="mx-auto size-14" />
        <DialogTitle className="mt-2 text-center text-[22px] font-bold tracking-[-0.02em]">{t('dayCompleteTitle')}</DialogTitle>
        <DialogDescription className="text-center text-[15.5px] leading-relaxed text-ink">
          {celebration && t('celebrationMessage', { i: celebration.i })}
        </DialogDescription>
        <blockquote className="m-0 mt-1 text-[14px] text-mut italic">“{celebration && t('celebrationQuote', { i: celebration.i })}”</blockquote>
        <button
          type="button"
          onClick={close}
          className="press mx-auto mt-4 cursor-pointer rounded-full bg-acc px-6 py-2.5 text-[15px] font-semibold text-accink"
        >
          {t('restWell')}
        </button>
      </DialogContent>
    </Dialog>
  )
}
