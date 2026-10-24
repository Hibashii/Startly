import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useStore } from '@/state/store'
import { DancingAvatar } from './Avatar'
import { useT } from '@/i18n/useT'

/**
 * Every task of the day checked, the biggest moment: the page blurs, Startly jumps up and dances,
 * confetti bursts from behind him in waves, and a card with a warm message and a quote (no numbers: finishing your day is the win).
 */
export function Celebration() {
  const celebration = useStore((s) => s.celebration)
  if (!celebration) return null
  return <Finale i={celebration.i} />
}

function Finale({ i }: { i: number }) {
  const close = useStore((s) => s.closeCelebration)
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    button.current?.focus()
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', escape)
    if (!canvas.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => document.removeEventListener('keydown', escape)
    const fire = confetti.create(canvas.current, { resize: true })
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#5b5bd6'
    const colors = [accent, '#f9a8d4', '#fcd34d', '#86efac', '#93c5fd']
    // Wave 1: a big burst from behind Startly as he lands. Wave 2: both sides. Wave 3: a last shower from the top.
    const timers = [
      setTimeout(() => fire({ particleCount: 140, spread: 110, startVelocity: 48, origin: { x: 0.5, y: 0.42 }, colors }), 450),
      setTimeout(() => {
        fire({ particleCount: 70, angle: 60, spread: 65, startVelocity: 55, origin: { x: 0, y: 0.75 }, colors })
        fire({ particleCount: 70, angle: 120, spread: 65, startVelocity: 55, origin: { x: 1, y: 0.75 }, colors })
      }, 1100),
      setTimeout(() => fire({ particleCount: 90, spread: 160, startVelocity: 25, gravity: 0.6, origin: { x: 0.5, y: 0 }, colors, scalar: 0.9 }), 2000),
    ]
    return () => {
      timers.forEach(clearTimeout)
      fire.reset()
      document.removeEventListener('keydown', escape)
    }
  }, [close])

  return (
    <div className="party-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-bg/55 p-4 backdrop-blur-lg" role="dialog" aria-modal="true" aria-labelledby="finale-title">
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 size-full" />
      <div className="relative flex w-full max-w-[420px] flex-col items-center">
        {/* Startly stands on the card's top edge, so the card itself sits in the middle of the screen */}
        <div className="finale-jump -mb-9">
          <DancingAvatar className="size-36" />
        </div>
        <div className="finale-card w-full rounded-[28px] border bg-card px-7 pt-12 pb-7 text-center shadow-soft">
          <h2 id="finale-title" className="m-0 text-[30px] font-bold tracking-[-0.03em]">{t('dayCompleteTitle')}</h2>
          <p className="mt-4 mb-0 text-[16px] leading-relaxed">{t('celebrationMessage', { i })}</p>
          <blockquote className="m-0 mt-3 text-[14px] leading-relaxed text-mut italic">“{t('celebrationQuote', { i })}”</blockquote>
          <button ref={button} type="button" onClick={close} className="press mt-6 cursor-pointer rounded-full bg-acc px-7 py-2.5 text-[15px] font-semibold text-accink">
            {t('restWell')}
          </button>
        </div>
      </div>
    </div>
  )
}
