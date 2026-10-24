import type { Lang, Name, Text } from '@/i18n'

export type Priority = 'high' | 'medium' | 'low'
export type Accent = 'iris' | 'ocean' | 'sage' | 'plum' | 'pink' | 'coral' | 'ink'

export interface Task {
  id: string // short, e.g. "t7", so the AI can refer to it
  title: string
  kind: 'task' | 'fixed' // fixed = appointment with exact time
  durationMin: number
  priority: Priority
  deadline: string | null // "YYYY-MM-DD"
  preferredStart: string | null // "HH:MM": not before (a hold)
  endBy?: string | null // "HH:MM": must be finished by ("the shop closes at 20:00")
  date: string | null // day it's scheduled on (null = unplaced)
  start: string | null // "HH:MM", set by the scheduler (or fixed)
  status: 'todo' | 'done'
  order: number // stable tiebreak
  rank?: number | null // Startly's suggested position in today's order (null = no suggestion)
  preplanned?: boolean // its start came from laying out a later day in advance (redone when that day comes)
  partOf?: string // set on the rest of task X after it was split (same title; shown as "X (cont.)")
  slot?: string | null // "HH:MM": where Startly planned it (a soft hold, like a school timetable); preferredStart (yours) wins
  focus?: boolean // focus work (study, coding…) gets the timer's Start; false = an activity (gym, groceries). Unset = focus
}

export interface Block {
  date: string
  start: string
  end: string
  type: 'task' | 'fixed' | 'lunch' | 'break'
  taskId?: string
}

export interface Window {
  start: string
  end: string
}

/**
 * A chat message: words someone typed (you, or the AI's own reply, in whatever language it was written),
 * or a reply written by code (`content`, shown in the app's language). Never neither, never both.
 */
export type ChatMessage = ChatBody & ({ role: 'user'; text: string } | { role: 'assistant'; text: string } | { role: 'assistant'; content: Text })

interface ChatBody {
  id: string
  moved?: { id?: string; title: Name; from: string; to: string | null; at?: string | null }[] // what moved: to = "HH:MM", a later date (at: its time there, null = not set), or null (not today)
  notes?: Text[] // code-written notes: removed, didn't fit…
  suggestions?: string[] // Startly asked something: answers to tap (they're sent as your message)
  question?: {
    pendingId: string
    text: Text
    options: { id: string; label: Text }[]
    choose?: { id: string; title: string; partIds: string[] }[] // "Choose": one checkbox per task
    answered?: Text
  } // Startly asks
}

export interface Settings {
  lang: Lang
  accent: Accent
  theme: 'light' | 'dark' | null
  endOfDay: string // "HH:MM", may pass midnight: "25:00" = 1 am
  breaks?: { afterMin: number; lengthMin: number } // a break after this much back-to-back work (0 = between every task)
  timerMode?: 'normal' | 'pomodoro' // the focus timer: one countdown per task, or 25/5 rounds
  timerSound?: boolean // the bell when time is up (on unless turned off)
  profile?: Profile // asked once, before the first plan (skipped = empty, not asked again)
}

export interface Profile {
  focusBest: 'morning' | 'afternoon' | 'evening' | null
  habits: string // fixed habits in your words: "gym Mon/Wed/Fri 18:00, work 9–17 on weekdays"
}

export interface Plan {
  tasks: Task[]
  blocks: Record<string, Block[]>
  availability: Record<string, Window[]> // free time, by date "YYYY-MM-DD" or weekday "mon".."sun"
  settings: Settings
  dayEnds?: Record<string, string> // one-day end-of-day overrides ("keep it, I'll stay until 23:40")
}
