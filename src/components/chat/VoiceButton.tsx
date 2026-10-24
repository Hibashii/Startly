import { useEffect, useRef } from 'react'
import { LoaderCircle, Mic, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/i18n/useT'
import type { Key } from '@/i18n'
import { cn } from '@/lib/utils'
import { useVoice, voiceSupported, type VoiceEnd, type VoiceError } from '@/lib/useVoice'

const ERRORS: Record<VoiceError, Key> = {
  no_mic: 'voiceNoMic', rate_limited: 'errRateLimited', unavailable: 'voiceFailed', empty: 'voiceEmpty',
}

export type Voice = ReturnType<typeof useVoice>

/** The voice recorder for a text box. Errors show as a toast; Escape throws the recording away. */
export function useVoiceInput(onText: (text: string, end: VoiceEnd) => void) {
  const t = useT()
  const voice = useVoice({ onText, onError: (e) => toast(t(ERRORS[e])) })
  useEffect(() => {
    if (voice.state !== 'recording') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && voice.cancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voice.state, voice.cancel])
  return voice
}

const round = 'grid size-[34px] flex-none cursor-pointer place-items-center rounded-full disabled:cursor-default'

/** The mic in the text box: starts recording. Hidden where the browser can't record. */
export function MicButton({ voice, className }: { voice: Voice; className?: string }) {
  const t = useT()
  if (!voiceSupported()) return null
  return (
    <button type="button" onClick={voice.start} aria-label={t('voiceStart')} className={cn(round, 'text-mut hover:text-ink', className)}>
      <Mic className="size-[18px]" strokeWidth={2} />
    </button>
  )
}

/** ✕: throw the recording away. */
export function CancelVoice({ voice, className }: { voice: Voice; className?: string }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={voice.cancel}
      disabled={voice.state !== 'recording'}
      aria-label={t('voiceCancel')}
      className={cn(round, 'border text-ink hover:bg-blk disabled:opacity-40', className)}
    >
      <X className="size-4" strokeWidth={2.2} />
    </button>
  )
}

/** ■: stop and put the words in the box, to read before sending. */
export function StopVoice({ voice, className }: { voice: Voice; className?: string }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={voice.insert}
      disabled={voice.state !== 'recording'}
      aria-label={t(voice.ending === 'insert' ? 'voiceWorking' : 'voiceStop')}
      className={cn(round, 'border text-ink hover:bg-blk disabled:opacity-40', voice.ending === 'insert' && 'disabled:opacity-100', className)}
    >
      {voice.ending === 'insert' ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-3" fill="currentColor" strokeWidth={0} />}
    </button>
  )
}

const STEP = 5 // px from one bar to the next
const BAR = 2.5
const TICK = 70 // ms per bar: how fast the line scrolls

/**
 * The live waveform: dots for silence, bars as tall as the voice, new sound coming in on the right.
 * Freezes once recording stops.
 */
export function Waveform({ voice, className }: { voice: Voice; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const levels = useRef<number[]>([])
  const live = voice.state === 'recording'
  const level = useRef(voice.level)
  level.current = voice.level

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const draw = () => {
      const { width, height } = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      if (el.width !== Math.round(width * dpr)) el.width = Math.round(width * dpr)
      if (el.height !== Math.round(height * dpr)) el.height = Math.round(height * dpr)
      const ctx = el.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = getComputedStyle(el).color
      const n = Math.floor(width / STEP)
      const all = levels.current
      for (let i = 0; i < n; i++) {
        const v = all[all.length - n + i] ?? 0 // right-aligned: the newest bar is at the end
        const h = Math.max(BAR, v * (height - 4))
        ctx.globalAlpha = v > 0.04 ? 0.7 : 0.35
        ctx.beginPath()
        ctx.roundRect(i * STEP + (STEP - BAR) / 2, (height - h) / 2, BAR, h, BAR / 2)
        ctx.fill()
      }
    }
    if (!live) return draw()
    levels.current = []
    let last = 0
    let peak = 0
    let frame = requestAnimationFrame(function tick(now) {
      peak = Math.max(peak, level.current()) // the loudest moment since the last bar, so short syllables show
      if (now - last >= TICK) {
        levels.current.push(peak)
        if (levels.current.length > 600) levels.current.splice(0, 300)
        peak = 0
        last = now
        draw()
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [live])

  return <canvas ref={canvas} aria-hidden className={cn('h-8 min-w-0 flex-1 text-ink', className)} />
}

/** Adds heard words after what's already typed. */
export const appendHeard = (now: string, heard: string) => (now.trim() ? `${now.trimEnd()} ${heard}` : heard)
