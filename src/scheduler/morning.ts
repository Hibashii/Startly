import type { Task } from '@/types'
import type { Question } from './questions'
import { plusDays } from './days'

// A new day: a fresh chat, a greeting, and a question about what wasn't checked (never silently carried over).

/** Unchecked tasks left on an earlier day. */
export const leftovers = (tasks: Task[], today: string) =>
  tasks.filter((t) => t.kind === 'task' && t.status === 'todo' && t.date !== null && t.date < today)

const GREETINGS = {
  morning: ['Good morning ☀️', 'Good morning! New day, fresh start.', 'Morning! Ready when you are.'],
  afternoon: ['Good afternoon!', 'Hi again! Here for the rest of your day.'],
  evening: ['Good evening!', 'Evening! Let’s make the most of what’s left.'],
}

/** A greeting written by code (no AI call), picked from a few variants. */
export function greeting(hour: number, hasPlan: boolean, seed: number) {
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const options = GREETINGS[part]
  const hello = options[seed % options.length]
  return hasPlan ? `${hello} Your plan is still here.` : `${hello} What's on today? Tell me everything and I'll plan it.`
}

export interface LeftoverItem {
  id: string // the original task
  title: string
  partIds: string[] // its unfinished parts ("X" and "X (cont.)")
}

/** One item per task: a split task's unfinished parts count as one. */
export function groupLeftovers(left: Task[], all: Task[]): LeftoverItem[] {
  const groups = new Map<string, LeftoverItem>()
  for (const t of left) {
    const root = t.partOf ?? t.id
    const title = all.find((x) => x.id === root)?.title ?? t.title.replace(/ \(cont\.\)$/, '')
    const g = groups.get(root) ?? { id: root, title, partIds: [] }
    g.partIds.push(t.id)
    groups.set(root, g)
  }
  return [...groups.values()]
}

/** What each answer does: add moves the task (all its parts, merged) to today; drop removes its unfinished parts. */
export const addItem = (item: LeftoverItem, today: string) => ({ type: 'move_to_day' as const, id: item.partIds[0], date: today })
export const dropItem = (item: LeftoverItem) => item.partIds.map((id) => ({ type: 'remove_one' as const, id }))

/** "2 things from yesterday weren't checked: Groceries, Job application #3. Add them to today?" */
export function morningQuestion(left: Task[], all: Task[], today: string): (Question & { choose?: LeftoverItem[] }) | null {
  const items = groupLeftovers(left, all)
  if (!items.length) return null
  const when = left.every((t) => t.date === plusDays(today, -1)) ? 'yesterday' : 'earlier'
  const addAll = { extra: items.map((i) => addItem(i, today)) }
  const dropAll = { extra: items.flatMap(dropItem) }
  if (items.length === 1) {
    return {
      text: `'${items[0].title}' from ${when} wasn't checked. Add it to today?`,
      options: [
        { id: 'add', label: 'Add it', ...addAll },
        { id: 'drop', label: 'Drop it', ...dropAll },
      ],
      blocking: false,
    }
  }
  return {
    text: `${items.length} things from ${when} weren't checked: ${items.map((i) => i.title).join(', ')}. Add them to today?`,
    options: [
      { id: 'add', label: items.length === 2 ? 'Add both' : 'Add all', ...addAll },
      { id: 'choose', label: 'Choose', extra: [] }, // the chat shows a checkbox per task (never picked by the AI)
      { id: 'drop', label: 'Drop them', ...dropAll },
    ],
    blocking: false,
    choose: items,
  }
}
