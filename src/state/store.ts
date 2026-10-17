import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, ChatMessage, Plan, Settings, Task, Window } from '@/types'
import { askStartly, buildContext } from '@/lib/api'
import { clock, clockOf, dateKey, now, toMin } from '@/lib/time'
import { applyActions } from '@/scheduler/applyActions'
import { diffToday, toastText } from '@/scheduler/diff'
import { toast } from 'sonner'

interface Persisted {
  tasks: Task[]
  blocks: Record<string, Block[]>
  availability: Record<string, Window[]>
  settings: Settings
  chat: { date: string; messages: ChatMessage[] }
  pending: null
  lastCelebratedDate: string | null
}

interface Ui {
  chatOpen: boolean
  thinking: boolean
  /** The last message that couldn't reach Startly (shown with Retry, not saved). */
  failed: { text: string; error: 'rate_limited' | 'unavailable' } | null
  /** Task ids that just moved or arrived: their cards glow briefly, then fade. */
  flash: string[]
  /** The first plan just arrived: its cards rise in one by one. */
  justPlanned: boolean
}

interface Actions {
  /** Send a message to Startly; returns false if the assistant couldn't be reached. */
  send: (text: string) => Promise<{ ok: boolean; error?: string }>
  setChatOpen: (open: boolean) => void
}

export type Store = Persisted & Ui & Actions

const fresh = (): Persisted => ({
  tasks: [],
  blocks: {},
  availability: {},
  settings: { accent: 'iris', theme: null, endOfDay: '23:00' },
  chat: { date: dateKey(now()), messages: [] },
  pending: null,
  lastCelebratedDate: null,
})

let msgId = 0
const mid = () => `m${Date.now().toString(36)}${msgId++}`

export const planOf = (s: Persisted): Plan => ({
  tasks: s.tasks,
  blocks: s.blocks,
  availability: s.availability,
  settings: s.settings,
})

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...fresh(),
      chatOpen: false,
      thinking: false,
      failed: null,
      flash: [],
      justPlanned: false,

      setChatOpen: (chatOpen) => set({ chatOpen }),

      send: async (text) => {
        const s = get()
        if (s.thinking) return { ok: false, error: 'busy' } // one request at a time
        const userMsg: ChatMessage = { id: mid(), role: 'user', text }
        set({ thinking: true, failed: null, chat: { ...s.chat, messages: [...s.chat.messages, userMsg] } })

        const at = now()
        const res = await askStartly(text, buildContext(planOf(s), s.chat.messages, s.pending, at))
        if (!res.ok) {
          // Leave the plan untouched; take the message back out so it can be retried.
          set((cur) => ({
            thinking: false,
            failed: { text, error: res.error },
            chat: { ...cur.chat, messages: cur.chat.messages.filter((m) => m.id !== userMsg.id) },
          }))
          return { ok: false, error: res.error }
        }

        const cur = get()
        const today = dateKey(at)
        const result = applyActions(planOf(cur), res.data.actions, today, toMin(clockOf(at)), res.data.order ?? null)
        const reply: ChatMessage = { id: mid(), role: 'assistant', text: res.data.reply }
        const changed = result.applied > 0

        if (!changed && res.data.actions.length > 0) {
          reply.text = "Sorry, I didn't quite get that. Could you say it another way?"
        }
        let note: string | null = null
        let flash: string[] = []
        if (changed) {
          // Written by code from the actual change, so it's always accurate.
          const diff = diffToday(cur.tasks, result.plan.tasks, today)
          const wasUnplaced = new Set(cur.tasks.filter((t) => t.kind === 'task' && t.date === null).map((t) => t.id))
          const newlyUnplaced = result.unplaced.filter((id) => !wasUnplaced.has(id))
          const titles = (ids: string[]) => ids.map((id) => result.plan.tasks.find((t) => t.id === id)?.title).filter(Boolean)
          const notes: string[] = []
          if (diff.removed.length) notes.push(`Removed: ${diff.removed.join(', ')}.`)
          if (newlyUnplaced.length) notes.push(`These don't fit before ${clock(result.plan.settings.endOfDay)} today: ${titles(newlyUnplaced).join(', ')}.`)
          const moved = diff.moved.filter((m) => m.to !== 'not today')
          if (moved.length) reply.moved = moved
          if (notes.length) reply.notes = notes
          if (cur.tasks.length) {
            // No toast or glow for the very first plan.
            note = toastText(diff)
            flash = [...moved.map((m) => m.id), ...diff.addedIds]
          }
        }

        set({
          ...(changed ? result.plan : {}),
          thinking: false,
          chatOpen: true,
          flash,
          justPlanned: changed && cur.tasks.length === 0,
          chat: { ...cur.chat, messages: [...cur.chat.messages, reply] },
        })
        if (note) toast(note)
        if (flash.length) setTimeout(() => set({ flash: [] }), 2600)
        if (get().justPlanned) setTimeout(() => set({ justPlanned: false }), 1500)
        return { ok: true }
      },
    }),
    {
      name: 'startly-v1',
      version: 1,
      partialize: (s): Persisted => ({
        tasks: s.tasks,
        blocks: s.blocks,
        availability: s.availability,
        settings: s.settings,
        chat: s.chat,
        pending: s.pending,
        lastCelebratedDate: s.lastCelebratedDate,
      }),
      // Saved data from an unknown version starts fresh instead of crashing.
      migrate: () => fresh(),
    },
  ),
)
