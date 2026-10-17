import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { useStore } from '@/state/store'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Avatar } from './Avatar'

/** Every task of the day checked: confetti falls, and a warm message with a discipline quote. */
export function Celebration() {
  const celebration = useStore((s) => s.celebration)
  const close = useStore((s) => s.closeCelebration)

  useEffect(() => {
    if (!celebration || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#5b5bd6'
    const colors = [accent, '#f9a8d4', '#fcd34d', '#86efac']
    confetti({ particleCount: 140, spread: 80, startVelocity: 42, origin: { y: 0.3 }, colors, disableForReducedMotion: true })
    const id = setTimeout(() => confetti({ particleCount: 80, spread: 110, origin: { y: 0.25 }, colors, disableForReducedMotion: true }), 350)
    return () => clearTimeout(id)
  }, [celebration])

  return (
    <Dialog open={!!celebration} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="max-w-[420px] rounded-[24px] border bg-card p-8 text-center text-ink">
        <Avatar className="mx-auto size-14" />
        <DialogTitle className="mt-2 text-[22px] font-bold tracking-[-0.02em]">Day complete</DialogTitle>
        <DialogDescription className="text-[15.5px] leading-relaxed text-ink">{celebration?.message}</DialogDescription>
        <blockquote className="m-0 mt-1 text-[14px] text-mut italic">“{celebration?.quote}”</blockquote>
        <button
          type="button"
          onClick={close}
          className="press mx-auto mt-4 cursor-pointer rounded-full bg-acc px-6 py-2.5 text-[15px] font-semibold text-accink"
        >
          Rest well
        </button>
      </DialogContent>
    </Dialog>
  )
}
