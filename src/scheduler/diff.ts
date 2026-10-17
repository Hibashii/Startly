import type { Task } from '@/types'
import { shortDay } from './days'

export interface Moved {
  id: string
  title: string
  from: string // "HH:MM"
  to: string // "HH:MM", or a short label like "not today"
}

export interface Diff {
  moved: Moved[]
  added: string[]
  addedIds: string[]
  removed: string[]
}

/** Compares today's tasks before and after a change. Written by code, so the summary is always accurate. */
export function diffToday(before: Task[], after: Task[], today: string): Diff {
  const prev = new Map(before.map((t) => [t.id, t]))
  const next = new Map(after.map((t) => [t.id, t]))
  const moved: Moved[] = []
  const added: string[] = []
  const addedIds: string[] = []

  for (const t of after) {
    const old = prev.get(t.id)
    if (!old) {
      if (t.kind === 'task' || t.date === today) {
        added.push(t.title)
        addedIds.push(t.id)
      }
      continue
    }
    const wasToday = old.date === today && old.start !== null
    const isToday = t.date === today && t.start !== null
    if (wasToday && isToday && old.start !== t.start) moved.push({ id: t.id, title: t.title, from: old.start!, to: t.start! })
    else if (wasToday && !isToday) {
      const to = t.date && t.date > today ? shortDay(t.date) : 'not today'
      moved.push({ id: t.id, title: t.title, from: old.start!, to })
    }
  }
  const removed = before.filter((t) => !next.has(t.id)).map((t) => t.title)
  moved.sort((a, b) => (a.from < b.from ? -1 : 1))
  return { moved, added, addedIds, removed }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The short toast after a change, or null when nothing on the timetable changed. */
export function toastText(d: Diff): string | null {
  if (d.removed.length) return `✓ Removed ${d.removed.join(', ')}`
  const shifted = d.moved.filter((m) => m.to !== 'not today').length
  if (shifted) return `↻ Reshuffled ${plural(shifted, 'task')}`
  if (d.added.length) return `✓ Added ${plural(d.added.length, 'task')}`
  return null
}
