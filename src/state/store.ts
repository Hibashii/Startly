import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { Block, ChatMessage, Plan, Settings, Task, Window } from '@/types'
import { askStartly, buildContext } from '@/lib/api'
import { clock, clockOf, dateKey, now, roundUp5, toHHMM, toMin } from '@/lib/time'
import { applyActions, type AnyAction, type ApplyResult } from '@/scheduler/applyActions'
import { dayName, plusDays } from '@/scheduler/days'
import { dayComplete } from '@/scheduler/now'
import { CELEBRATIONS, ENCOURAGEMENTS, pick } from '@/lib/messages'
import { diffToday, toastText } from '@/scheduler/diff'
import { findQuestion, measureAnswer, type QuestionOption } from '@/scheduler/questions'
import { endOfDayFor, reshuffleToday } from '@/scheduler/schedule'

/** A question Startly asked: the change waits until one of the prepared answers is picked. */
export interface Pending {
  id: string
  date: string // asked on this day; it expires at midnight
  question: string
  options: QuestionOption[]
  base: { actions: AnyAction[]; order: string[] | null } // the change that raised the question
}

interface Persisted {
  tasks: Task[]
  blocks: Record<string, Block[]>
  availability: Record<string, Window[]>
  settings: Settings
  dayEnds: Record<string, string>
  chat: { date: string; messages: ChatMessage[] }
  pending: Pending | null
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
  /** Which day the timetable shows, and whether the week strip is open. */
  selectedDate: string
  weekOpen: boolean
  /** Every task of the day is checked: confetti and a message. */
  celebration: { message: string; quote: string } | null
  /** List (default) or an hour grid like a calendar day view. */
  view: 'list' | 'grid'
}

interface Actions {
  /** Send a message to Startly; returns false if the assistant couldn't be reached. */
  send: (text: string) => Promise<{ ok: boolean; error?: string }>
  /** Answer Startly's question with one of its buttons. */
  answer: (optionId: string) => void
  /** Check or uncheck a task. */
  toggleDone: (taskId: string) => void
  rename: (taskId: string, title: string) => void
  /** The Now card's buttons, handled by code (no AI call). */
  quick: (taskId: string, what: 'more' | 'notStarted' | 'tomorrow') => void
  closeCelebration: () => void
  setAccent: (accent: Settings['accent']) => void
  setTheme: (theme: 'light' | 'dark') => void
  setView: (view: 'list' | 'grid') => void
  setChatOpen: (open: boolean) => void
  setWeekOpen: (open: boolean) => void
  selectDate: (date: string) => void
}

export type Store = Persisted & Ui & Actions

const fresh = (): Persisted => ({
  tasks: [],
  blocks: {},
  availability: {},
  settings: { accent: 'iris', theme: null, endOfDay: '23:00' },
  dayEnds: {},
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
  dayEnds: s.dayEnds,
})

/** Show a question as closed in the chat (answered, skipped or expired). */
const closeQuestion = (messages: ChatMessage[], pendingId: string, answered: string) =>
  messages.map((m) => (m.question?.pendingId === pendingId ? { ...m, question: { ...m.question, answered } } : m))

const clockNow = () => {
  const at = now()
  return { at, today: dateKey(at), nowMin: toMin(clockOf(at)) }
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /**
       * Apply a change, or ask first when it creates a real tradeoff.
       * Returns the message Startly adds to the chat (its reply + code-written notes or a question).
       */
      function commit(prev: Plan, actions: AnyAction[], order: string[] | null, replyText: string) {
        const { today, nowMin } = clockNow()
        const run = (extra: AnyAction[] = []): ApplyResult => applyActions(prev, [...actions, ...extra], today, nowMin, order)
        const result = run()
        const reply: ChatMessage = { id: mid(), role: 'assistant', text: replyText }
        const changed = result.applied > 0

        if (!changed) {
          // Nothing changed: an open question stays open ("how late is that?" doesn't answer it).
          if (actions.some((a) => a.type !== 'resolve_pending')) reply.text = "Sorry, I didn't quite get that. Could you say it another way?"
          else if (actions.length) reply.text = `${replyText}\n\nYou can answer with the buttons above.`
          set((cur) => ({ chat: { ...cur.chat, messages: [...cur.chat.messages, reply] } }))
          return
        }
        // A real new change replaces an open question: show it as skipped, so its change visibly didn't happen.
        const open = get().pending
        const skipOpen = (messages: ChatMessage[]) => (open ? closeQuestion(messages, open.id, 'skipped (you changed something else)') : messages)

        const question = findQuestion(prev, result, today, run)
        let pending: Pending | null = null
        if (question) {
          // Blocking: nothing changes until an answer is picked. Otherwise the change applies now and the answer acts on top.
          const base = question.blocking ? { actions, order } : { actions: [], order: null }
          pending = { id: mid(), date: today, question: question.text, options: question.options, base }
          reply.question = { pendingId: pending.id, text: question.text, options: question.options.map(({ id, label }) => ({ id, label })) }
          if (question.blocking) {
            set((cur) => ({ pending, chatOpen: true, chat: { ...cur.chat, messages: [...skipOpen(cur.chat.messages), reply] } }))
            return
          }
        }

        // Written by code from the actual change, so it's always accurate.
        const next = result.plan
        const title = (id: string) => next.tasks.find((t) => t.id === id)?.title ?? ''
        const diff = diffToday(prev.tasks, next.tasks, today)
        const wasUnplaced = new Set(prev.tasks.filter((t) => t.kind === 'task' && t.date === null).map((t) => t.id))
        const newlyUnplaced = result.unplaced.filter((id) => !wasUnplaced.has(id))
        const notes: string[] = []
        if (diff.removed.length) notes.push(`Removed: ${diff.removed.join(', ')}.`)
        for (const m of result.movedLater) {
          const t = next.tasks.find((x) => x.id === m.id)!
          notes.push(`Put '${t.title}' on ${dayName(m.date)}, since it's due ${dayName(t.deadline!)}.`)
        }
        const askDays = [...new Set([...result.needFreeTime.map((n) => n.date), ...result.unknownDays])]
        for (const d of askDays) {
          const waiting = result.needFreeTime.filter((n) => n.date === d).map((n) => `'${title(n.id)}'`)
          notes.push(`When are you free on ${dayName(d)}?${waiting.length ? ` I'd like to fit ${waiting.join(', ')} in before it's due.` : " Tell me and I'll plan it."}`)
        }
        const laterNoFit = result.laterUnplaced.filter((u) => !prev.tasks.some((t) => t.id === u.id && t.date === u.date && !t.start && u.date in prev.blocks))
        for (const d of [...new Set(laterNoFit.map((u) => u.date))]) {
          notes.push(`These don't fit on ${dayName(d)}: ${laterNoFit.filter((u) => u.date === d).map((u) => title(u.id)).join(', ')}.`)
        }
        if (result.plannedDays.length) notes.push(`Planned ${result.plannedDays.map(dayName).join(', ')} hour by hour.`)
        // (The one Startly is asking about is covered by its question.)
        const unasked = newlyUnplaced.filter((id) => !pending?.options.some((o) => o.extra.some((a) => 'id' in a && a.id === id)))
        if (unasked.length) notes.push(`These don't fit before ${clock(endOfDayFor(next, today))} today: ${unasked.map(title).join(', ')}.`)
        const moved = diff.moved.filter((m) => m.to !== 'not today')
        if (moved.length) reply.moved = moved
        if (notes.length) reply.notes = notes

        const firstPlan = prev.tasks.length === 0
        const flash = firstPlan ? [] : [...moved.map((m) => m.id), ...diff.addedIds]
        set((cur) => ({
          ...next,
          dayEnds: next.dayEnds ?? {},
          pending,
          chatOpen: true,
          flash,
          justPlanned: firstPlan,
          chat: { ...cur.chat, messages: [...skipOpen(cur.chat.messages), reply] },
        }))
        const note = firstPlan ? null : toastText(diff)
        if (note) toast(note)
        if (flash.length) setTimeout(() => set({ flash: [] }), 2600)
        if (firstPlan) setTimeout(() => set({ justPlanned: false }), 1500)
      }

      /** A question from an earlier day no longer makes sense ("tomorrow" has moved): close it. */
      function expireOldQuestion() {
        const p = get().pending
        if (p && p.date !== clockNow().today) {
          set((cur) => ({ pending: null, chat: { ...cur.chat, messages: closeQuestion(cur.chat.messages, p.id, 'expired') } }))
        }
      }

      return {
        ...fresh(),
        chatOpen: false,
        thinking: false,
        failed: null,
        flash: [],
        justPlanned: false,
        selectedDate: dateKey(now()),
        weekOpen: false,
        celebration: null,
        view: 'list',

        toggleDone: (taskId) => {
          const { today, nowMin } = clockNow()
          const s = get()
          const task = s.tasks.find((t) => t.id === taskId)
          if (!task) return
          if (task.status === 'done') {
            set({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'todo' as const } : t)) })
            return
          }
          // Checking any part finishes the whole task: parts not started yet go, and one still
          // running ends now, so the next tasks move up.
          const root = task.partOf ?? task.id
          const isPart = (t: Task) => t.id === root || t.partOf === root
          const notStarted = (t: Task) => t.status === 'todo' && t.date === today && t.start !== null && toMin(t.start) >= nowMin && t.id !== taskId
          let tasks = s.tasks
            .filter((t) => !(isPart(t) && notStarted(t)))
            .map((t) => {
              if (!isPart(t) || t.status === 'done') return t
              const running = t.date === today && t.start && toMin(t.start) < nowMin && toMin(t.start) + t.durationMin > nowMin
              return { ...t, status: 'done' as const, durationMin: running ? Math.max(5, roundUp5(nowMin) - toMin(t.start!)) : t.durationMin }
            })
          const prev = planOf(s)
          const reshuffled = reshuffleToday({ ...prev, tasks }, today, nowMin).plan
          tasks = reshuffled.tasks
          const moved = diffToday(s.tasks, tasks, today).moved.map((m) => m.id)
          set({ tasks, blocks: reshuffled.blocks, flash: moved })
          if (moved.length) setTimeout(() => set({ flash: [] }), 2600)
          if (dayComplete(reshuffled.blocks[today] ?? [], tasks) && s.lastCelebratedDate !== today) {
            set({ celebration: pick(CELEBRATIONS), lastCelebratedDate: today })
          } else {
            toast(pick(ENCOURAGEMENTS))
          }
        },

        rename: (taskId, title) => {
          const clean = title.trim()
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || !clean || clean === task.title) return
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, title: clean } : t)) }))
          toast('✓ Renamed')
        },

        quick: (taskId, what) => {
          const { at, today } = clockNow()
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || get().thinking) return
          const tomorrow = plusDays(today, 1)
          const [actions, text]: [AnyAction[], string] =
            what === 'more'
              ? [[{ type: 'extend_task', id: taskId, extraMin: 30 }], `Added 30 min to '${task.title}'.`]
              : what === 'notStarted'
                ? [[{ type: 'started_at', id: taskId, start: toHHMM(Math.floor(toMin(clockOf(at)) / 5) * 5), remainingMin: null }], `OK, '${task.title}' starts now.`]
                : [[{ type: 'move_to_day', id: taskId, date: tomorrow }], `Moved '${task.title}' to ${dayName(tomorrow)}.`]
          commit(planOf(get()), actions, null, text)
        },

        closeCelebration: () => set({ celebration: null }),
        setAccent: (accent) => set((s) => ({ settings: { ...s.settings, accent } })),
        setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
        setView: (view) => set({ view }),

        setChatOpen: (chatOpen) => set({ chatOpen }),
        setWeekOpen: (weekOpen) => set(weekOpen ? { weekOpen } : { weekOpen, selectedDate: dateKey(now()) }),
        selectDate: (selectedDate) => set({ selectedDate }),

        send: async (text) => {
          expireOldQuestion()
          const s = get()
          if (s.thinking) return { ok: false, error: 'busy' } // one request at a time
          const userMsg: ChatMessage = { id: mid(), role: 'user', text }
          set({ thinking: true, failed: null, chat: { ...s.chat, messages: [...s.chat.messages, userMsg] } })

          const { at } = clockNow()
          const pendingForAi = s.pending && { question: s.pending.question, options: s.pending.options.map(({ id, label }) => ({ id, label })) }
          const res = await askStartly(text, buildContext(planOf(s), s.chat.messages, pendingForAi, at))
          if (!res.ok) {
            // Leave the plan untouched; take the message back out so it can be retried.
            set((cur) => ({
              thinking: false,
              failed: { text, error: res.error },
              chat: { ...cur.chat, messages: cur.chat.messages.filter((m) => m.id !== userMsg.id) },
            }))
            return { ok: false, error: res.error }
          }
          set({ thinking: false })

          // "ok keep it" in words answers the open question.
          const resolve = res.data.actions.find((a) => a.type === 'resolve_pending')
          const cur = get()
          if (resolve && cur.pending?.options.some((o) => o.id === resolve.optionId)) {
            get().answer(resolve.optionId)
            return { ok: true }
          }
          commit(planOf(cur), res.data.actions, res.data.order ?? null, res.data.reply)
          return { ok: true }
        },

        answer: (optionId) => {
          expireOldQuestion()
          const p = get().pending
          const option = p?.options.find((o) => o.id === optionId)
          if (!p || !option) return
          // Mark the question as answered, then apply the change with that answer.
          set((cur) => ({ pending: null, chat: { ...cur.chat, messages: closeQuestion(cur.chat.messages, p.id, option.label) } }))
          const { today, nowMin } = clockNow()
          const prev = planOf(get())
          const simulate = (extra: AnyAction[]) => applyActions(prev, [...p.base.actions, ...extra], today, nowMin, p.base.order)
          commit(prev, [...p.base.actions, ...measureAnswer(option.extra, today, simulate)], p.base.order, `${option.label}.`)
        },
      }
    },
    {
      name: 'startly-v1',
      version: 1,
      partialize: (s): Persisted => ({
        tasks: s.tasks,
        blocks: s.blocks,
        availability: s.availability,
        settings: s.settings,
        dayEnds: s.dayEnds,
        chat: s.chat,
        pending: s.pending,
        lastCelebratedDate: s.lastCelebratedDate,
      }),
      // Older saves may miss newer fields.
      merge: (saved, current) => ({ ...current, ...(saved as Partial<Persisted>), dayEnds: (saved as Partial<Persisted>)?.dayEnds ?? {} }),
      // Saved data from an unknown version starts fresh instead of crashing.
      migrate: () => fresh(),
    },
  ),
)
