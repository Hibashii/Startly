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

/** A timetable time for display: "25:15" (past midnight) shows as "01:15". */
export const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':')
  return `${String(Number(h) % 24).padStart(2, '0')}:${m}`
}

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const clockOf = (d: Date) => format(d, 'HH:mm')
export const roundUp5 = (min: number) => Math.ceil(min / 5) * 5

/** Re-renders the component every 30 s so clocks and "today" stay current. */
export function useNow(): Date {
  const [at, setAt] = useState(now)
  useEffect(() => {
    const id = setInterval(() => setAt(now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return at
}
