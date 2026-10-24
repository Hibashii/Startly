import { useSyncExternalStore } from 'react'

/** Whether a media query matches now, kept up to date (a window resized, a phone turned). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia(query)
      q.addEventListener('change', cb)
      return () => q.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}
