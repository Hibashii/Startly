import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, ChatMessage, Plan, Settings, Task, Window } from '@/types'
import { askStartly, buildContext } from '@/lib/api'
import { clockOf, dateKey, now, toMin } from '@/lib/time'
import { applyActions } from '@/scheduler/applyActions'

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

      setChatOpen: (chatOpen) => set({ chatOpen }),

      send: async (text) => {
        const s = get()
        if (s.thinking) return { ok: false, error: 'busy' } // one request at a time
        const userMsg: ChatMessage = { id: mid(), role: 'user', text }
        set({ thinking: true, chat: { ...s.chat, messages: [...s.chat.messages, userMsg] } })

        const at = now()
        const res = await askStartly(text, buildContext(planOf(s), s.chat.messages, s.pending, at))
        if (!res.ok) {
          // Leave the plan untouched; take the message back out so it can be retried.
          set((cur) => ({
            thinking: false,
            chat: { ...cur.chat, messages: cur.chat.messages.filter((m) => m.id !== userMsg.id) },
          }))
          return { ok: false, error: res.error }
        }

        const cur = get()
        const result = applyActions(planOf(cur), res.data.actions, dateKey(at), toMin(clockOf(at)))
        const titles = (ids: string[]) => ids.map((id) => result.plan.tasks.find((t) => t.id === id)?.title).filter(Boolean)
        let reply = res.data.reply
        if (result.unplaced.length) reply += `\n\nThese don't fit before ${cur.settings.endOfDay} today: ${titles(result.unplaced).join(', ')}.`

        set({
          ...result.plan,
          thinking: false,
          chatOpen: true,
          chat: { ...cur.chat, messages: [...cur.chat.messages, { id: mid(), role: 'assistant', text: reply }] },
        })
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
