export type Priority = 'high' | 'medium' | 'low'
export type Accent = 'iris' | 'ocean' | 'sage' | 'plum' | 'coral' | 'ink'

export interface Task {
  id: string // short, e.g. "t7", so the AI can refer to it
  title: string
  kind: 'task' | 'fixed' // fixed = appointment with exact time
  durationMin: number
  priority: Priority
  deadline: string | null // "YYYY-MM-DD"
  preferredStart: string | null // "HH:MM"
  date: string | null // day it's scheduled on (null = unplaced)
  start: string | null // "HH:MM", set by the scheduler (or fixed)
  status: 'todo' | 'done'
  order: number // stable tiebreak
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
  moved?: { title: string; from: string; to: string }[]
}

export interface Settings {
  accent: Accent
  theme: 'light' | 'dark' | null
  endOfDay: string
}

export interface Plan {
  tasks: Task[]
  blocks: Record<string, Block[]>
  availability: Record<string, Window[]>
  settings: Settings
}
