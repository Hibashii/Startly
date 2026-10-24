import { useRef } from 'react'

/**
 * Which way to slide when `key` (a date, or a week's Monday) changes: forward in time comes in from the end side,
 * back in time from the start side. Kept until the next change, so a re-render mid-slide doesn't cut it short.
 * Put the class on an element keyed by the same value, so the animation plays again each time.
 */
export function useSlide(key: string): string {
  const last = useRef({ key, cls: '' })
  if (last.current.key !== key) last.current = { key, cls: key > last.current.key ? 'slide-next' : 'slide-prev' }
  return last.current.cls
}
