export type Priority = 'high' | 'medium' | 'low'
export type Accent = 'iris' | 'ocean' | 'sage' | 'plum' | 'coral' | 'ink'

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
  partOf?: string // set on "X (cont.)": the rest of task X after it was split
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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  moved?: { id?: string; title: string; from: string; to: string }[] // code-written: what moved
  notes?: string[] // code-written: removed, didn't fit…
  question?: {
    pendingId: string
    text: string
    options: { id: string; label: string }[]
    choose?: { id: string; title: string; partIds: string[] }[] // "Choose": one checkbox per task
    answered?: string
  } // Startly asks
}

export interface Settings {
  accent: Accent
  theme: 'light' | 'dark' | null
  endOfDay: string // "HH:MM", may pass midnight: "25:00" = 1 am
  breaks?: { afterMin: number; lengthMin: number } // a break after this much back-to-back work (0 = between every task)
}

export interface Plan {
  tasks: Task[]
  blocks: Record<string, Block[]>
  availability: Record<string, Window[]> // free time, by date "YYYY-MM-DD" or weekday "mon".."sun"
  settings: Settings
  dayEnds?: Record<string, string> // one-day end-of-day overrides ("keep it, I'll stay until 23:40")
}
