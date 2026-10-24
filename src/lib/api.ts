import type { AssistantContext, AssistantResponse } from '../../shared/schema'
import type { ChatMessage, Plan } from '@/types'
import { toHHMM } from './time'
import { dayOf, plusDays } from '@/scheduler/days'
import { translate, type Name } from '@/i18n'
import { DEFAULT_BREAKS } from '@/scheduler/schedule'
import { format, parseISO } from 'date-fns'

export type AskResult = { ok: true; data: AssistantResponse } | { ok: false; error: 'rate_limited' | 'unavailable' }

/** A chat message as the AI reads it: the words, plus the app's notes on what the change did (the AI can't see them otherwise). */
function asText(m: ChatMessage, lang: Plan['settings']['lang']): string {
  const words = 'content' in m ? translate(lang, m.content) : m.text
  const name = (n: Name) => (typeof n === 'string' ? n : `${n.cont} (cont.)`)
  const moved = (m.moved ?? []).map((x) => `[moved] ${name(x.title)}: ${x.from} → ${x.to ?? 'not today'}${x.at ? ` ${x.at}` : x.to && !x.to.includes(':') ? ' (time not set)' : ''}`)
  const notes = (m.notes ?? []).map((n) => `[note] ${translate(lang, n)}`)
  const question = m.question ? [`[asked] ${translate(lang, m.question.text)}${m.question.answered ? ` [answer] ${translate(lang, m.question.answered)}` : ''}`] : []
  return [words, ...moved, ...notes, ...question].join('\n')
}

export function buildContext(plan: Plan, messages: ChatMessage[], pending: unknown, at: Date, canUndo = false): AssistantContext {
  const { today, nowMin } = dayOf(at, plan)
  return {
    now: `${today}T${toHHMM(nowMin)}`, // past midnight on a late day: "24:30"
    weekday: format(parseISO(today), 'EEEE'),
    today,
    // What matters for planning: from today to 4 weeks ahead, plus what's waiting (unplaced, or an unfinished task
    // from the last week). Past appointments are over. A whole year of tasks would only make every answer slower.
    tasks: plan.tasks.filter((t) =>
      t.date === null ||
      (t.date >= today ? t.date <= plusDays(today, 28) : t.kind === 'task' && t.status === 'todo' && t.date >= plusDays(today, -7)),
    ).map(({ id, title, kind, date, start, durationMin, status, deadline, priority, partOf }) => ({
      id, title: partOf ? `${title} (cont.)` : title, kind, date, start, durationMin, status, deadline, priority,
      onTimetable: date !== null && (start !== null || date > today),
    })),
    availability: plan.availability,
    endOfDay: plan.settings.endOfDay,
    pending: pending ?? null,
    timetable: (plan.blocks[today] ?? []).map((b) => {
      const name = b.taskId ? (plan.tasks.find((t) => t.id === b.taskId)?.title ?? '') : b.type
      const done = plan.tasks.find((t) => t.id === b.taskId)?.status === 'done' ? ' (done)' : ''
      return `${b.start}-${b.end} ${name}${done}`
    }),
    breaks: plan.settings.breaks ?? DEFAULT_BREAKS,
    language: plan.settings.lang,
    profile: plan.settings.profile ?? null,
    recentMessages: messages.slice(-10).map((m) => ({ role: m.role, text: asText(m, plan.settings.lang) })),
    canUndo,
  }
}

/** The only place the browser talks to the server. */
export async function askStartly(message: string, context: AssistantContext): Promise<AskResult> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
      signal: AbortSignal.timeout(55_000), // a first plan can take the AI ~30 s
    })
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    if (!res.ok) return { ok: false, error: 'unavailable' }
    return { ok: true, data: (await res.json()) as AssistantResponse }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: 'rate_limited' | 'unavailable' }

/** A voice recording → the words in it. */
export async function transcribe(audio: Blob): Promise<TranscribeResult> {
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audio,
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    if (!res.ok) return { ok: false, error: 'unavailable' }
    return { ok: true, text: ((await res.json()) as { text: string }).text }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}
