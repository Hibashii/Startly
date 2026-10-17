import { useEffect, useState } from 'react'
import { format } from 'date-fns'

// Every time read goes through now(), so a demo-clock override is a one-line change later.
export function now(): Date {
  return new Date()
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHMM = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const clockOf = (d: Date) => format(d, 'HH:mm')
export const roundUp5 = (min: number) => Math.ceil(min / 5) * 5

/** "1h30", "45m", "2h" */
export function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}m`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Re-renders the component every 30 s so clocks and "today" stay current. */
export function useNow(): Date {
  const [at, setAt] = useState(now)
  useEffect(() => {
    const id = setInterval(() => setAt(now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return at
}
