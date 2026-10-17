import type { AssistantContext, AssistantResponse } from '../../shared/schema'
import type { ChatMessage, Plan } from '@/types'
import { toHHMM } from './time'
import { dayOf } from '@/scheduler/days'
import { translate } from '@/i18n'
import { DEFAULT_BREAKS } from '@/scheduler/schedule'
import { format, parseISO } from 'date-fns'

export type AskResult = { ok: true; data: AssistantResponse } | { ok: false; error: 'rate_limited' | 'unavailable' }

export function buildContext(plan: Plan, messages: ChatMessage[], pending: unknown, at: Date): AssistantContext {
  const { today, nowMin } = dayOf(at, plan)
  return {
    now: `${today}T${toHHMM(nowMin)}`, // past midnight on a late day: "24:30"
    weekday: format(parseISO(today), 'EEEE'),
    today,
    tasks: plan.tasks.map(({ id, title, kind, date, start, durationMin, status, deadline, priority, partOf }) => ({
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
    recentMessages: messages.slice(-10).map((m) => ({ role: m.role, text: 'content' in m ? translate(plan.settings.lang, m.content) : m.text })),
  }
}

/** The only place the browser talks to the server. */
export async function askStartly(message: string, context: AssistantContext): Promise<AskResult> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) return { ok: false, error: 'rate_limited' }
    if (!res.ok) return { ok: false, error: 'unavailable' }
    return { ok: true, data: (await res.json()) as AssistantResponse }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}
