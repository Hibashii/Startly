import type { Task } from '@/types'
import { msg, nameOf, type Name, type Text } from '@/i18n'

export interface Moved {
  id: string
  title: Name
  from: string // "HH:MM"
  to: string | null // "HH:MM", a later date "YYYY-MM-DD", or null (not today)
  at?: string | null // moved to a later date: its time there, or null (not set yet)
}

export interface Diff {
  moved: Moved[]
  added: Name[]
  addedIds: string[]
  removed: Name[]
}

/** Compares today's tasks before and after a change. Written by code, so the summary is always accurate. */
export function diffToday(before: Task[], after: Task[], today: string): Diff {
  const prev = new Map(before.map((t) => [t.id, t]))
  const next = new Map(after.map((t) => [t.id, t]))
  const moved: Moved[] = []
  const added: Name[] = []
  const addedIds: string[] = []

  for (const t of after) {
    const old = prev.get(t.id)
    if (!old) {
      if (t.kind === 'task' || t.date === today) {
        added.push(nameOf(t))
        addedIds.push(t.id)
      }
      continue
    }
    const wasToday = old.date === today && old.start !== null
    const isToday = t.date === today && t.start !== null
    if (wasToday && isToday && old.start !== t.start) moved.push({ id: t.id, title: nameOf(t), from: old.start!, to: t.start! })
    else if (wasToday && !isToday) {
      const to = t.date && t.date > today ? t.date : null
      moved.push({ id: t.id, title: nameOf(t), from: old.start!, to, ...(to && { at: t.start }) })
    }
  }
  const removed = before.filter((t) => !next.has(t.id)).map(nameOf)
  moved.sort((a, b) => (a.from < b.from ? -1 : 1))
  return { moved, added, addedIds, removed }
}

/** The short toast after a change, or null when nothing on the timetable changed. */
export function toastText(d: Diff): Text | null {
  if (d.removed.length) return msg('toastRemoved', { items: d.removed })
  const shifted = d.moved.filter((m) => m.to !== null).length
  if (shifted) return msg('toastReshuffled', { n: shifted })
  if (d.added.length) return msg('toastAdded', { n: d.added.length })
  return null
}
