import { z } from 'zod'

// One schema shared by the server (OpenAI structured outputs) and the browser.
// Structured outputs need every field present, so "optional" fields are nullable.

const hhmm = z.string().describe('24h local time "HH:MM"')
const ymd = z.string().describe('local date "YYYY-MM-DD"')
const priority = z.enum(['high', 'medium', 'low'])

export const Action = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_task'),
    title: z.string(),
    durationMin: z.number().int(),
    priority,
    deadline: ymd.nullable(),
    preferredStart: hhmm.nullable().describe('not before this time ("gym in the morning")'),
    endBy: hhmm.nullable().describe('must be finished by this time today ("before 20:00, the shop closes")'),
    date: ymd.nullable().describe('only if the user asked for a specific day; otherwise null'),
  }),
  z.object({
    type: z.literal('add_fixed'),
    title: z.string(),
    date: ymd,
    start: hhmm,
    end: hhmm,
  }),
  z.object({
    type: z.literal('update_task'),
    id: z.string(),
    title: z.string().nullable(),
    durationMin: z.number().int().nullable(),
    priority: priority.nullable(),
    deadline: ymd.nullable(),
    preferredStart: hhmm.nullable(),
    endBy: hhmm.nullable(),
  }),
  z.object({ type: z.literal('remove_task'), id: z.string() }),
  z.object({
    type: z.literal('started_at'),
    id: z.string(),
    start: hhmm,
    remainingMin: z.number().int().nullable(),
  }),
  z.object({ type: z.literal('extend_task'), id: z.string(), extraMin: z.number().int() }),
  z.object({ type: z.literal('move_to_day'), id: z.string(), date: ymd }),
  z.object({
    type: z.literal('set_availability'),
    key: z.string().describe('a date "YYYY-MM-DD" or a weekday "mon".."sun"'),
    windows: z.array(z.object({ start: hhmm, end: hhmm })),
  }),
  z.object({ type: z.literal('set_end_of_day'), time: hhmm.describe('"01:00" = 1 am tonight') }),
  z.object({
    type: z.literal('set_breaks'),
    afterMin: z.number().int().describe('a break after this many minutes of back-to-back work; 0 = between every task'),
    lengthMin: z.number().int().describe('break length in minutes'),
  }),
  z.object({ type: z.literal('plan_days'), dates: z.array(ymd) }),
  z.object({ type: z.literal('resolve_pending'), optionId: z.string() }),
])
export type Action = z.infer<typeof Action>

export const AssistantResponse = z.object({
  reply: z.string(),
  actions: z.array(Action),
  order: z
    .array(z.string())
    .nullable()
    .describe("Today's suggested order: ids of today's todo tasks not started yet (new tasks: their exact title), first to last. null = keep the current order."),
})
export type AssistantResponse = z.infer<typeof AssistantResponse>

export const ContextTask = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['task', 'fixed']),
  date: z.string().nullable(),
  start: z.string().nullable(),
  durationMin: z.number(),
  status: z.enum(['todo', 'done']),
  deadline: z.string().nullable(),
  priority,
  onTimetable: z.boolean().describe('false = it did not fit anywhere, the user cannot see it on a timetable'),
})

export const AssistantContext = z.object({
  now: z.string(),
  weekday: z.string(),
  today: z.string(),
  tasks: z.array(ContextTask),
  availability: z.record(z.string(), z.array(z.object({ start: z.string(), end: z.string() }))),
  endOfDay: z.string(),
  pending: z.unknown().nullable(),
  timetable: z.array(z.string()).describe("today's timetable as the app placed it, e.g. \"19:55-20:55 Prepare for interview\", \"20:55-21:10 break\""),
  breaks: z.object({ afterMin: z.number(), lengthMin: z.number() }),
  recentMessages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string() })),
})
export type AssistantContext = z.infer<typeof AssistantContext>

export const AssistantRequest = z.object({
  message: z.string().min(1).max(4000),
  context: AssistantContext,
})
export type AssistantRequest = z.infer<typeof AssistantRequest>
