import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { Block, ChatMessage, Plan, Profile, Settings, Task, Window } from '@/types'
import { askStartly, buildContext } from '@/lib/api'
import { clock, clockOf, dateKey, now, roundUp5, toHHMM, toMin, useNow } from '@/lib/time'
import { applyActions, type AnyAction, type ApplyResult } from '@/scheduler/applyActions'
import { dayOf, plusDays } from '@/scheduler/days'
import { dayComplete } from '@/scheduler/now'
import { addItem, dropItem, greeting, leftovers, morningQuestion } from '@/scheduler/morning'
import { cheerStage, pickCelebration, pickCheer } from '@/lib/messages'
import { detectLang, msg, nameOf, translate, type Lang, type Text } from '@/i18n'
import { diffToday, toastText } from '@/scheduler/diff'
import { findQuestion, measureAnswer, type QuestionOption } from '@/scheduler/questions'
import { endOfDayFor, reshuffleToday } from '@/scheduler/schedule'
import type { Timer } from '@/scheduler/timer'

type Slots = { ref: string; start: string; date?: string | null }[] | null
export type View = 'list' | 'grid' | 'week'

/** A question Startly asked: the change waits until one of the prepared answers is picked. */
export interface Pending {
  id: string
  date: string // asked on this planning day; it expires when the day ends
  kind?: 'morning' // the morning question about yesterday's unchecked tasks
  choose?: { id: string; title: string; partIds: string[] }[]
  reaskMorning?: boolean // it interrupted the morning question: ask that again once this is answered
  question: Text
  options: QuestionOption[]
  base: { actions: AnyAction[]; order: string[] | null; slots?: Slots } // the change that raised the question
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
  /** The focus timer you started (it runs to the end of the task's block). */
  timer: Timer | null
  /** The day you last used the timer: breaks get a countdown too. */
  focusDay: string | null
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
  /** Every task of the day is checked: confetti and a message (which one: i). */
  celebration: { i: number } | null
  /** The cheer after checking a task: a line that follows your progress through the day. */
  cheer: { id: number; line: Text } | null
  /** One day as a list (default) or an hour grid, or the whole week as an hour grid. */
  view: View
  /** Startly pops up in the middle for a moment (a focus round done). */
  pop: { id: number; line: Text } | null
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
  /** Start the focus timer on a task; starting late or early moves the rest of the day. */
  startTimer: (taskId: string) => void
  stopTimer: () => void
  /** "Time's up": done, 15 more minutes, or tomorrow. */
  timerEnd: (what: 'done' | 'more' | 'tomorrow', extraMin?: number) => void
  pauseTimer: () => void
  resumeTimer: () => void
  /** Use the timer on an activity anyway (it becomes focus work), or the other way round. */
  setFocus: (taskId: string, focus: boolean) => void
  showPop: (line: Text) => void
  setTimerMode: (mode: 'normal' | 'pomodoro') => void
  setTimerSound: (on: boolean) => void
  /** The first-time questions: how you work (and when your day ends). */
  setProfile: (profile: Profile, endOfDay?: string) => void
  closeCelebration: () => void
  /** On a new day: a fresh chat with a greeting, the plan kept, and a question about yesterday's unchecked tasks. */
  morningReset: () => void
  /** Empty the conversation (the plan stays). */
  clearChat: () => void
  /** Delete everything and go back to the first screen (your preferences stay). */
  startFresh: () => void
  /** "Choose": add the picked tasks to today, drop the rest. */
  answerChoose: (keepIds: string[]) => void
  setLang: (lang: Lang) => void
  setAccent: (accent: Settings['accent']) => void
  setTheme: (theme: 'light' | 'dark') => void
  setView: (view: View) => void
  /** The arrows: the same weekday one week earlier (-1) or later (+1). */
  shiftWeek: (by: -1 | 1) => void
  /** Back to today (its week and its day). */
  goToday: () => void
  setChatOpen: (open: boolean) => void
  setWeekOpen: (open: boolean) => void
  selectDate: (date: string) => void
}

export type Store = Persisted & Ui & Actions

const fresh = (): Persisted => ({
  tasks: [],
  blocks: {},
  availability: {},
  settings: { lang: detectLang(), accent: 'iris', theme: null, endOfDay: '23:00' },
  dayEnds: {},
  chat: { date: dateKey(now()), messages: [] },
  pending: null,
  lastCelebratedDate: null,
  timer: null,
  focusDay: null,
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
const closeQuestion = (messages: ChatMessage[], pendingId: string, answered: Text) =>
  messages.map((m) => (m.question?.pendingId === pendingId ? { ...m, question: { ...m.question, answered } } : m))



export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** The planning day and minute: a day that runs past midnight is still that day until it ends. */
      const clockNow = () => {
        const at = now()
        return { at, ...dayOf(at, planOf(get())) }
      }

      /** Words for a toast, in the app's language at the moment it shows. */
      const say = (text: Text) => toast(translate(get().settings.lang, text))

      /**
       * Apply a change, or ask first when it creates a real tradeoff, and add Startly's message to the chat:
       * its reply (the AI's own words, or a code-written one) plus code-written notes or a question.
       */
      function commit(prev: Plan, actions: AnyAction[], order: string[] | null, replyIn: string | Text, quiet = false, slots: Slots = null) {
        const { today, nowMin } = clockNow()
        const run = (extra: AnyAction[] = []): ApplyResult => applyActions(prev, [...actions, ...extra], today, nowMin, order, slots)
        const result = run()
        const changed = result.applied > 0
        // Nothing changed although actions came: Startly says it didn't understand (instead of the AI's reply).
        const misunderstood = !changed && actions.some((a) => a.type !== 'resolve_pending')
        const reply: ChatMessage =
          misunderstood ? { id: mid(), role: 'assistant', content: msg('didntGet') }
          : typeof replyIn === 'string' ? { id: mid(), role: 'assistant', text: replyIn }
          : { id: mid(), role: 'assistant', content: replyIn }

        if (!changed) {
          // An open question stays open ("how late is that?" doesn't answer it).
          if (!misunderstood && actions.length) reply.notes = [msg('answerWithButtons')]
          // (Startly may be asking something, like which days to plan: the chat opens so it's seen.)
          set((cur) => ({ chatOpen: quiet ? cur.chatOpen : true, chat: { ...cur.chat, messages: [...cur.chat.messages, reply] } }))
          return
        }
        // A real new change replaces an open question: show it as skipped, so its change visibly didn't happen.
        // The morning question stays open, though, unless a new question takes its place (then it's asked again after).
        const open = get().pending
        const morningOpen = open?.kind === 'morning'
        let skipOpen = (messages: ChatMessage[]) => (open && !morningOpen ? closeQuestion(messages, open.id, msg('questionSkipped')) : messages)

        const question = findQuestion(prev, result, today, run)
        let pending: Pending | null = null
        if (question) {
          // Blocking: nothing changes until an answer is picked. Otherwise the change applies now and the answer acts on top.
          const base = question.blocking ? { actions, order, slots } : { actions: [], order: null }
          pending = { id: mid(), date: today, question: question.text, options: question.options, base, reaskMorning: morningOpen || open?.reaskMorning }
          if (morningOpen) skipOpen = (messages) => closeQuestion(messages, open!.id, msg('questionLater'))
          reply.question = { pendingId: pending.id, text: question.text, options: question.options.map(({ id, label }) => ({ id, label })) }
          if (question.blocking) {
            set((cur) => ({ pending, chatOpen: true, chat: { ...cur.chat, messages: [...skipOpen(cur.chat.messages), reply] } }))
            return
          }
        }

        // Written by code from the actual change, so it's always accurate.
        const next = result.plan
        const title = (id: string) => nameOf(next.tasks.find((t) => t.id === id) ?? { title: '' })
        const diff = diffToday(prev.tasks, next.tasks, today)
        const wasUnplaced = new Set(prev.tasks.filter((t) => t.kind === 'task' && t.date === null).map((t) => t.id))
        const newlyUnplaced = result.unplaced.filter((id) => !wasUnplaced.has(id))
        const notes: Text[] = []
        if (diff.removed.length) notes.push(msg('noteRemoved', { items: diff.removed }))
        for (const m of result.movedLater) {
          const t = next.tasks.find((x) => x.id === m.id)!
          notes.push(msg('notePutOn', { title: nameOf(t), date: m.date, due: t.deadline! }))
        }
        const askDays = [...new Set([...result.needFreeTime.map((n) => n.date), ...result.unknownDays])]
        for (const d of askDays) {
          notes.push(msg('noteWhenFree', { date: d, waiting: result.needFreeTime.filter((n) => n.date === d).map((n) => title(n.id)) }))
        }
        const laterNoFit = result.laterUnplaced.filter((u) => !prev.tasks.some((t) => t.id === u.id && t.date === u.date && !t.start && u.date in prev.blocks))
        for (const d of [...new Set(laterNoFit.map((u) => u.date))]) {
          notes.push(msg('noteNoFitOn', { date: d, items: laterNoFit.filter((u) => u.date === d).map((u) => title(u.id)) }))
        }
        if (result.plannedDays.length) notes.push(msg('notePlanned', { dates: result.plannedDays }))
        // (The one Startly is asking about is covered by its question.)
        const unasked = newlyUnplaced.filter((id) => !pending?.options.some((o) => o.extra.some((a) => 'id' in a && a.id === id)))
        if (unasked.length) notes.push(msg('noteNoFitToday', { end: clock(endOfDayFor(next, today)), items: unasked.map(title) }))
        const moved = diff.moved.filter((m) => m.to !== null)
        if (moved.length) reply.moved = moved
        if (notes.length) reply.notes = notes

        const firstPlan = prev.tasks.length === 0
        const flash = firstPlan ? [] : [...moved.map((m) => m.id), ...diff.addedIds]
        if (!pending && morningOpen) pending = open // still waiting for an answer
        // Quiet (the timer's buttons): the timetable changes and a toast says so; the chat only hears about what needs reading.
        const post = !quiet || !!pending || notes.length > 0
        set((cur) => ({
          ...next,
          dayEnds: next.dayEnds ?? {},
          pending,
          chatOpen: post ? true : cur.chatOpen,
          flash,
          justPlanned: firstPlan,
          chat: { ...cur.chat, messages: post ? [...skipOpen(cur.chat.messages), reply] : cur.chat.messages },
        }))
        const note = firstPlan ? null : toastText(diff)
        if (note) say(note)
        if (flash.length) setTimeout(() => set({ flash: [] }), 2600)
        if (firstPlan) setTimeout(() => set({ justPlanned: false }), 1500)
        if (!pending && open?.reaskMorning) askMorning(today, false)
      }

      /** Ask about earlier days' unchecked tasks (on a new day, or again after another question interrupted it). */
      function askMorning(today: string, greet: boolean, at = now()): ChatMessage | null {
        const s = get()
        const q = morningQuestion(leftovers(s.tasks, today), s.tasks, today)
        const hasPlan = s.tasks.some((t) => t.date === today || (t.date === null && t.status === 'todo'))
        if (!q && !greet) return null
        const hello: ChatMessage = { id: mid(), role: 'assistant', content: greet ? greeting(at.getHours(), hasPlan, at.getDate()) : msg('backToEarlier') }
        let pending: Pending | null = null
        if (q) {
          pending = { id: mid(), date: today, kind: 'morning', question: q.text, options: q.options, base: { actions: [], order: null }, choose: q.choose }
          hello.question = { pendingId: pending.id, text: q.text, options: q.options.map(({ id, label }) => ({ id, label })), choose: q.choose }
        }
        if (greet) set({ pending, chatOpen: !!pending || s.chatOpen, chat: { date: today, messages: [hello] } })
        else set((cur) => ({ pending, chatOpen: true, chat: { ...cur.chat, messages: [...cur.chat.messages, hello] } }))
        return hello
      }

      /** A question from an earlier day no longer makes sense ("tomorrow" has moved): close it. */
      function expireOldQuestion() {
        const p = get().pending
        if (p && p.date !== clockNow().today) {
          set((cur) => ({ pending: null, chat: { ...cur.chat, messages: closeQuestion(cur.chat.messages, p.id, msg('questionExpired')) } }))
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
        pop: null,

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
          const timerDone = s.timer && isPart(s.tasks.find((t) => t.id === s.timer!.taskId) ?? task)
          set({ tasks, blocks: reshuffled.blocks, flash: moved, ...(timerDone && { timer: null }) })
          if (moved.length) setTimeout(() => set({ flash: [] }), 2600)
          // Every time the day becomes complete (again), the finale.
          if (dayComplete(reshuffled.blocks[today] ?? [], tasks)) {
            set({ celebration: { i: pickCelebration() }, lastCelebratedDate: today, cheer: null })
          } else {
            // How far along today is: tasks and appointments on today's timetable.
            const ids = new Set((reshuffled.blocks[today] ?? []).filter((b) => b.taskId).map((b) => b.taskId!))
            const todays = tasks.filter((t) => ids.has(t.id))
            const done = todays.filter((t) => t.status === 'done').length
            const stage = cheerStage(done, todays.length)
            const cheer = { id: Date.now(), line: msg('cheer', { stage, i: pickCheer(stage) }) }
            set({ cheer })
            setTimeout(() => get().cheer?.id === cheer.id && set({ cheer: null }), 2400)
          }
        },

        rename: (taskId, title) => {
          const clean = title.trim()
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || !clean || clean === task.title) return
          // A split task is one task: all its parts take the new name.
          const root = task.partOf ?? task.id
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === root || t.partOf === root ? { ...t, title: clean } : t)) }))
          say(msg('toastRenamed'))
        },

        quick: (taskId, what) => {
          const { at, today } = clockNow()
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task || get().thinking) return
          const tomorrow = plusDays(today, 1)
          const [actions, reply]: [AnyAction[], Text] =
            what === 'more'
              ? [[{ type: 'extend_task', id: taskId, extraMin: 30 }], msg('addedMore', { title: nameOf(task) })]
              : what === 'notStarted'
                ? [[{ type: 'started_at', id: taskId, start: toHHMM(Math.floor(toMin(clockOf(at)) / 5) * 5), remainingMin: null }], msg('startsNow', { title: nameOf(task) })]
                : [[{ type: 'move_to_day', id: taskId, date: tomorrow }], msg('movedTo', { title: nameOf(task), date: tomorrow })]
          commit(planOf(get()), actions, null, reply)
        },

        startTimer: (taskId) => {
          const { today, nowMin } = clockNow()
          const s = get()
          const task = s.tasks.find((t) => t.id === taskId)
          if (!task || task.kind !== 'task' || task.status === 'done' || s.thinking) return
          const block = (s.blocks[today] ?? []).find((b) => b.taskId === taskId)
          const start = Math.floor(nowMin / 5) * 5
          // Starting 5+ minutes off the plan (late, or early on the next task): the day moves to match.
          if (!block || Math.abs(toMin(block.start) - start) >= 5) {
            commit(planOf(s), [{ type: 'started_at', id: taskId, start: toHHMM(start), remainingMin: null }], null, msg('startsNow', { title: nameOf(task) }), true)
          }
          set({ timer: { taskId, startedAt: Date.now() }, focusDay: today })
        },

        stopTimer: () => set({ timer: null }),
        pauseTimer: () => set((s) => (s.timer && !s.timer.pausedAt ? { timer: { ...s.timer, pausedAt: Date.now() } } : {})),
        resumeTimer: () =>
          set((s) => {
            if (!s.timer?.pausedAt) return {}
            const pausedMs = (s.timer.pausedMs ?? 0) + Date.now() - s.timer.pausedAt
            return { timer: { ...s.timer, pausedAt: null, pausedMs } }
          }),
        setFocus: (taskId, focus) => {
          const task = get().tasks.find((t) => t.id === taskId)
          if (!task) return
          const root = task.partOf ?? task.id
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === root || t.partOf === root ? { ...t, focus } : t)) }))
        },
        showPop: (line) => {
          const pop = { id: Date.now(), line }
          set({ pop })
          setTimeout(() => get().pop?.id === pop.id && set({ pop: null }), 3400)
        },

        timerEnd: (what, extraMin) => {
          const s = get()
          const task = s.timer && s.tasks.find((t) => t.id === s.timer!.taskId)
          if (!task) return set({ timer: null })
          if (what === 'done') return get().toggleDone(task.id) // (clears the timer)
          if (what === 'more') {
            const min = extraMin ?? 15
            // The paused time is given back once: the timer starts counting pauses again from zero.
            set({ timer: { ...s.timer!, pausedAt: null, pausedMs: 0 } })
            commit(planOf(get()), [{ type: 'extend_task', id: task.id, extraMin: min }], null, msg('addedMore', { title: nameOf(task), min }), true)
            return
          }
          const tomorrow = plusDays(clockNow().today, 1)
          set({ timer: null })
          commit(planOf(get()), [{ type: 'move_to_day', id: task.id, date: tomorrow }], null, msg('movedTo', { title: nameOf(task), date: tomorrow }), true)
        },

        setTimerMode: (timerMode) => set((s) => ({ settings: { ...s.settings, timerMode } })),
        setTimerSound: (timerSound) => set((s) => ({ settings: { ...s.settings, timerSound } })),
        setProfile: (profile, endOfDay) => set((s) => ({ settings: { ...s.settings, profile, endOfDay: endOfDay ?? s.settings.endOfDay } })),

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
          say(msg('toastChatCleared'))
        },

        startFresh: () => {
          const { settings } = get()
          set({
            ...fresh(),
            // Your preferences stay: language, color, mode, usual end of day, break rule.
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
          set((cur) => ({ pending: null, chat: { ...cur.chat, messages: closeQuestion(cur.chat.messages, p.id, msg('nAdded', { n: keep.size })) } }))
          commit(planOf(get()), extra, null, msg(keep.size ? 'addedToToday' : 'droppedThem'))
        },

        setLang: (lang) => set((s) => ({ settings: { ...s.settings, lang } })),
        setAccent: (accent) => set((s) => ({ settings: { ...s.settings, accent } })),
        setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
        setView: (view) => set({ view }),
        shiftWeek: (by) => {
          const { today } = clockNow()
          const date = plusDays(get().selectedDate ?? today, by * 7)
          set({ selectedDate: date === today ? null : date })
        },
        goToday: () => set({ selectedDate: null }),
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
          const words = (x: Text) => translate(s.settings.lang, x)
          const pendingForAi = s.pending && {
            question: words(s.pending.question),
            options: s.pending.options.filter((o) => o.id !== 'choose').map(({ id, label }) => ({ id, label: words(label) })),
          }
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
            commit(planOf(cur), res.data.actions.filter((a) => a.type !== 'resolve_pending'), res.data.order ?? null, res.data.reply, false, res.data.slots ?? null)
            // Startly asked something: its suggested answers go on its reply, as buttons to tap.
            const suggestions = (res.data.suggestions ?? []).map((x) => x.trim().slice(0, 80)).filter(Boolean).slice(0, 4)
            if (suggestions.length) {
              set((s2) => {
                const messages = [...s2.chat.messages]
                const last = messages.length - 1
                if (last >= 0 && messages[last].role === 'assistant' && !messages[last].question) messages[last] = { ...messages[last], suggestions }
                return { chat: { ...s2.chat, messages } }
              })
            }
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
          const simulate = (extra: AnyAction[]) => applyActions(prev, [...p.base.actions, ...extra], today, nowMin, p.base.order, p.base.slots ?? null)
          commit(prev, [...p.base.actions, ...measureAnswer(option.extra, today, simulate)], p.base.order, option.label, false, p.base.slots ?? null)
        },
      }
    },
    {
      name: 'startly-v1',
      version: 2,
      partialize: (s): Persisted => ({
        tasks: s.tasks,
        blocks: s.blocks,
        availability: s.availability,
        settings: s.settings,
        dayEnds: s.dayEnds,
        chat: s.chat,
        pending: s.pending,
        lastCelebratedDate: s.lastCelebratedDate,
        timer: s.timer,
        focusDay: s.focusDay,
      }),
      // Older saves may miss newer fields.
      merge: (saved, current) => ({ ...current, ...(saved as Partial<Persisted>), dayEnds: (saved as Partial<Persisted>)?.dayEnds ?? {}, timer: (saved as Partial<Persisted>)?.timer ?? null }),
      migrate: (saved, version) => (version === 1 ? fromV1(saved) : fresh()), // anything unknown starts fresh
    },
  ),
)

/**
 * v1 → v2: chat messages became language-free data, so the old chat is cleared; the plan is kept.
 * Every field falls back to a safe default, so a damaged save can't break the scheduler.
 */
function fromV1(saved: unknown): Persisted {
  const base = fresh()
  if (!saved || typeof saved !== 'object') return base
  const old = saved as Partial<Persisted>
  const tasks = Array.isArray(old.tasks)
    ? old.tasks.map((t) => (t.partOf ? { ...t, title: t.title.replace(/ \(cont\.\)$/, '') } : t)) // "(cont.)" is now added on screen
    : base.tasks
  return {
    ...base,
    tasks,
    blocks: old.blocks && typeof old.blocks === 'object' ? old.blocks : base.blocks,
    availability: old.availability && typeof old.availability === 'object' ? old.availability : base.availability,
    settings: { ...base.settings, ...(old.settings ?? {}), lang: detectLang() },
    dayEnds: old.dayEnds && typeof old.dayEnds === 'object' ? old.dayEnds : base.dayEnds,
    chat: { date: typeof old.chat?.date === 'string' ? old.chat.date : base.chat.date, messages: [] },
    lastCelebratedDate: typeof old.lastCelebratedDate === 'string' ? old.lastCelebratedDate : null,
  }
}

/** The planning day for components: a day running past midnight is still "today" until it ends. */
export function useDay() {
  const at = useNow()
  const endOfDay = useStore((s) => s.settings.endOfDay)
  const dayEnds = useStore((s) => s.dayEnds)
  return { at, ...dayOf(at, { settings: { endOfDay }, dayEnds }) }
}
