import { useEffect, useRef, type RefObject } from 'react'

/**
 * A quick sideways swipe on the page (a phone): `onSwipe(1)` for the next one (swiping right to left; mirrored in Arabic),
 * `onSwipe(-1)` for the previous. A mostly-vertical move is a scroll and does nothing; so is one that starts in a field.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (by: -1 | 1) => void, key?: unknown) {
  const latest = useRef(onSwipe)
  latest.current = onSwipe
  useEffect(() => {
    // The whole scrolling page, not just the content (a short day leaves most of it empty).
    const area = ref.current?.closest('main') ?? ref.current
    if (!area) return
    let start: { x: number; y: number; at: number } | null = null
    const down = (e: TouchEvent) => {
      const p = e.touches[0]
      const el = e.target as HTMLElement
      start = e.touches.length === 1 && !el.closest('input, textarea, select, [contenteditable]') ? { x: p.clientX, y: p.clientY, at: e.timeStamp } : null
    }
    const up = (e: TouchEvent) => {
      if (!start) return
      const p = e.changedTouches[0]
      const dx = p.clientX - start.x
      const dy = p.clientY - start.y
      const quick = e.timeStamp - start.at < 700
      start = null
      if (!quick || Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return
      const forward = dx < 0 !== (document.documentElement.dir === 'rtl')
      latest.current(forward ? 1 : -1)
    }
    const cancel = () => (start = null)
    area.addEventListener('touchstart', down, { passive: true })
    area.addEventListener('touchend', up, { passive: true })
    area.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      area.removeEventListener('touchstart', down)
      area.removeEventListener('touchend', up)
      area.removeEventListener('touchcancel', cancel)
    }
  }, [ref, key])
}
