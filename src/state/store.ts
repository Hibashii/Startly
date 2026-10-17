import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { Block, ChatMessage, Plan, Settings, Task, Window } from '@/types'
import { askStartly, buildContext } from '@/lib/api'
import { clock, clockOf, dateKey, now, roundUp5, toHHMM, toMin, useNow } from '@/lib/time'
import { applyActions, type AnyAction, type ApplyResult } from '@/scheduler/applyActions'
import { dayName, dayOf, plusDays } from '@/scheduler/days'
import { dayComplete } from '@/scheduler/now'
import { addItem, dropItem, greeting, leftovers, morningQuestion } from '@/scheduler/morning'
import { CELEBRATIONS, cheerLine, pick } from '@/lib/messages'
import { diffToday, toastText } from '@/scheduler/diff'
import { findQuestion, measureAnswer, type QuestionOption } from '@/scheduler/questions'
import { endOfDayFor, reshuffleToday } from '@/scheduler/schedule'

/** A question Startly asked: the change waits until one of the prepared answers is picked. */
export interface Pending {
  id: string
  date: string // asked on this planning day; it expires when the day ends
  kind?: 'morning' // the morning question about yesterday's unchecked tasks
  choose?: { id: string; title: string; partIds: string[] }[]
  reaskMorning?: boolean // it interrupted the morning question: ask that again once this is answered
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
  selectedDate: string | null // null = today
  weekOpen: boolean
  /** Every task of the day is checked: confetti and a message. */
  celebration: { message: string; quote: string } | null
  /** The cheer after checking a task: a line that follows your progress, and how far along the day is. */
  cheer: { id: number; line: string; done: number; total: number } | null
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
  /** On a new day: a fresh chat with a greeting, the plan kept, and a question about yesterday's unchecked tasks. */
  morningReset: () => void
  /** Empty the conversation (the plan stays). */
  clearChat: () => void
  /** Delete everything and go back to the first screen (color and mode stay). */
  startFresh: () => void
  /** "Choose": add the picked tasks to today, drop the rest. */
  answerChoose: (keepIds: string[]) => void
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



export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** The planning day and minute: a day that runs past midnight is still that day until it ends. */
      const clockNow = () => {
        const at = now()
        return { at, ...dayOf(at, planOf(get())) }
      }

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
        // The morning question stays open, though, unless a new question takes its place (then it's asked again after).
        const open = get().pending
        const morningOpen = open?.kind === 'morning'
        let skipOpen = (messages: ChatMessage[]) => (open && !morningOpen ? closeQuestion(messages, open.id, 'skipped (you changed something else)') : messages)

        const question = findQuestion(prev, result, today, run)
        let pending: Pending | null = null
        if (question) {
          // Blocking: nothing changes until an answer is picked. Otherwise the change applies now and the answer acts on top.
          const base = question.blocking ? { actions, order } : { actions: [], order: null }
          pending = { id: mid(), date: today, question: question.text, options: question.options, base, reaskMorning: morningOpen || open?.reaskMorning }
          if (morningOpen) skipOpen = (messages) => closeQuestion(messages, open!.id, 'later')
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
        if (!pending && morningOpen) pending = open // still waiting for an answer
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
        if (!pending && open?.reaskMorning) askMorning(today, false)
      }

      /** Ask about earlier days' unchecked tasks (on a new day, or again after another question interrupted it). */
      function askMorning(today: string, greet: boolean, at = now()): ChatMessage | null {
        const s = get()
        const q = morningQuestion(leftovers(s.tasks, today), s.tasks, today)
        const hasPlan = s.tasks.some((t) => t.date === today || (t.date === null && t.status === 'todo'))
        const text = greet ? greeting(at.getHours(), hasPlan, at.getDate()) : 'Back to the earlier question:'
        if (!q && !greet) return null
        const msg: ChatMessage = { id: mid(), role: 'assistant', text }
        let pending: Pending | null = null
        if (q) {
          pending = { id: mid(), date: today, kind: 'morning', question: q.text, options: q.options, base: { actions: [], order: null }, choose: q.choose }
          msg.question = { pendingId: pending.id, text: q.text, options: q.options.map(({ id, label }) => ({ id, label })), choose: q.choose }
        }
        if (greet) set({ pending, chatOpen: !!pending || s.chatOpen, chat: { date: today, messages: [msg] } })
        else set((cur) => ({ pending, chatOpen: true, chat: { ...cur.chat, messages: [...cur.chat.messages, msg] } }))
        return msg
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
        selectedDate: null,
        weekOpen: false,
        celebration: null,
        cheer: null,
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
          // Every time the day becomes complete (again), the finale.
          if (dayComplete(reshuffled.blocks[today] ?? [], tasks)) {
            set({ celebration: pick(CELEBRATIONS), lastCelebratedDate: today, cheer: null })
          } else {
            // How far along today is: tasks and appointments on today's timetable.
            const ids = new Set((reshuffled.blocks[today] ?? []).filter((b) => b.taskId).map((b) => b.taskId!))
            const todays = tasks.filter((t) => ids.has(t.id))
            const done = todays.filter((t) => t.status === 'done').length
            const cheer = { id: Date.now(), line: cheerLine(done, todays.length), done, total: todays.length }
            set({ cheer })
            setTimeout(() => get().cheer?.id === cheer.id && set({ cheer: null }), 2400)
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

        morningReset: () => {
          const { at, today, nowMin } = clockNow()
          const s = get()
          if (s.chat.date === today) return
          if (s.thinking) return // after the request finishes (send runs it again)
          if (!s.tasks.length && !s.chat.messages.length) {
            set({ chat: { date: today, messages: [] } })
            return
          }
          // The plan is kept: today is (re)laid out; what wasn't checked waits for the question.
          const plan = applyActions(planOf(s), [], today, nowMin).plan
          set({ ...plan, dayEnds: plan.dayEnds ?? {}, pending: null })
          askMorning(today, true, at)
        },

        clearChat: () => {
          set((s) => ({ pending: null, failed: null, chat: { ...s.chat, messages: [] } }))
          toast('✓ Chat cleared')
        },

        startFresh: () => {
          const { settings } = get()
          set({
            ...fresh(),
            // Your preferences stay: color, mode, usual end of day, break rule.
            settings: { ...settings },
            chatOpen: false,
            weekOpen: false,
            selectedDate: null,
            flash: [],
            cheer: null,
            celebration: null,
            failed: null,
          })
        },

        answerChoose: (keepIds) => {
          const p = get().pending
          if (!p?.choose) return
          const { today } = clockNow()
          const keep = new Set(keepIds)
          const extra: AnyAction[] = p.choose.flatMap((item): AnyAction[] => (keep.has(item.id) ? [addItem(item, today)] : dropItem(item)))
          set((cur) => ({ pending: null, chat: { ...cur.chat, messages: closeQuestion(cur.chat.messages, p.id, `${keep.size} added`) } }))
          commit(planOf(get()), extra, null, keep.size ? 'Added to today.' : 'Dropped them.')
        },

        setAccent: (accent) => set((s) => ({ settings: { ...s.settings, accent } })),
        setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
        setView: (view) => set({ view }),
        setChatOpen: (chatOpen) => set({ chatOpen }),
        setWeekOpen: (weekOpen) => set(weekOpen ? { weekOpen } : { weekOpen, selectedDate: null }),
        selectDate: (date) => set({ selectedDate: date === clockNow().today ? null : date }),

        send: async (text) => {
          get().morningReset()
          expireOldQuestion()
          const s = get()
          if (s.thinking) return { ok: false, error: 'busy' } // one request at a time
          const userMsg: ChatMessage = { id: mid(), role: 'user', text }
          set({ thinking: true, failed: null, chat: { ...s.chat, messages: [...s.chat.messages, userMsg] } })

          const { at } = clockNow()
          // "Choose" is only the checkbox button: the AI can't pick it.
          const pendingForAi = s.pending && { question: s.pending.question, options: s.pending.options.filter((o) => o.id !== 'choose').map(({ id, label }) => ({ id, label })) }
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
          // Only answers the question it was asked about (not one that replaced it meanwhile).
          if (resolve && cur.pending && cur.pending.id === s.pending?.id && cur.pending.options.some((o) => o.id === resolve.optionId && o.id !== 'choose')) {
            get().answer(resolve.optionId)
          } else {
            commit(planOf(cur), res.data.actions.filter((a) => a.type !== 'resolve_pending'), res.data.order ?? null, res.data.reply)
          }
          get().morningReset() // in case the day changed during the request
          return { ok: true }
        },

        answer: (optionId) => {
          expireOldQuestion()
          const p = get().pending
          const option = p?.options.find((o) => o.id === optionId)
          if (!p || !option || option.id === 'choose') return
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

/** The planning day for components: a day running past midnight is still "today" until it ends. */
export function useDay() {
  const at = useNow()
  const endOfDay = useStore((s) => s.settings.endOfDay)
  const dayEnds = useStore((s) => s.dayEnds)
  return { at, ...dayOf(at, { tasks: [], blocks: {}, availability: {}, settings: { accent: 'iris', theme: null, endOfDay }, dayEnds }) }
}
