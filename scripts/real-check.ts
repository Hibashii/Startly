// Real-model conversation checks (costs a few cents). Run: npm run check:real
// Each scenario replays a conversation through the real OpenAI call + the real scheduler,
// and checks what the timetable actually shows — not just that the AI answered.
import { existsSync } from 'node:fs'
import { callAssistant } from '../server/assistant'
import { applyActions } from '../src/scheduler/applyActions'
import { buildContext } from '../src/lib/api'
import type { ChatMessage, Plan } from '../src/types'

if (existsSync('.env')) process.loadEnvFile('.env')

const TODAY = '2026-10-17'
type Check = (plan: Plan, reply: string) => string | null // returns a failure message, or null

const fresh = (): Plan => ({ tasks: [], blocks: {}, availability: {}, settings: { accent: 'iris', theme: null, endOfDay: '23:00' } })
const onTimetable = (p: Plan, re: RegExp) => p.tasks.some((t) => re.test(t.title) && t.date === TODAY && t.start)
const count = (p: Plan, re: RegExp) => p.tasks.filter((t) => re.test(t.title)).length
const show = (p: Plan) =>
  (p.blocks[TODAY] ?? []).map((b) => `${b.start}-${b.end} ${b.taskId ? p.tasks.find((t) => t.id === b.taskId)?.title : b.type}`).join(' | ') +
  (p.tasks.some((t) => !t.date) ? `  [not placed: ${p.tasks.filter((t) => !t.date).map((t) => t.title).join(', ')}]` : '')

async function scenario(name: string, steps: { at: string; say: string; check: Check }[]) {
  let plan = fresh()
  const messages: ChatMessage[] = []
  let failures = 0
  console.log(`\n▶ ${name}`)
  for (const step of steps) {
    const at = new Date(`${TODAY}T${step.at}:00`)
    const res = await callAssistant(step.say, buildContext(plan, messages, null, at))
    const r = applyActions(plan, res.actions, TODAY, at.getHours() * 60 + at.getMinutes(), res.order)
    if (r.applied > 0) plan = r.plan
    messages.push({ id: String(messages.length), role: 'user', text: step.say }, { id: String(messages.length + 1), role: 'assistant', text: res.reply })
    const fail = step.check(plan, res.reply)
    console.log(`  ${step.at} you: ${step.say}\n        startly: ${res.reply}\n        actions: ${res.actions.map((a) => a.type).join(', ') || '—'}   order: ${res.order?.join(' → ') ?? '—'}\n        timetable: ${show(plan)}\n        ${fail ? `✗ ${fail}` : '✓'}`)
    if (fail) failures++
  }
  return failures
}

const failures = [
  await scenario("Evening dump where groceries doesn't fit", [
    {
      at: '17:45',
      say: 'prepare for interview 1h30 due monday, finish hackathon project 2h due wednesday, gym, get groceries',
      check: (p) => (count(p, /grocer/i) === 1 ? null : 'groceries should exist exactly once'),
    },
    {
      at: '17:47',
      say: "you didn't add the groceries part!",
      check: (p, reply) =>
        count(p, /grocer/i) > 1 ? 'added a duplicate groceries task'
        : onTimetable(p, /grocer/i) ? null // it fixed it by changing the plan: fine
        : /already (on|in)|already added|is on your list/i.test(reply) ? 'claimed groceries is on the list when it is not'
        : null,
    },
    {
      at: '17:48',
      say: "ok I can stay up until midnight, put it in",
      check: (p) => (onTimetable(p, /grocer/i) && count(p, /grocer/i) === 1 ? null : 'groceries should now be on the timetable, once'),
    },
  ]),
  await scenario('Shop closes at 20:00, can stay up until 1 am', [
    {
      at: '17:45',
      say: 'prepare for interview 1h30 due monday, finish hackathon project 2h due wednesday, gym, get groceries',
      check: () => null,
    },
    {
      at: '17:56',
      say: 'okay then put the groceries before 20 because it closes at 20 and i need to do them! as for the finish hackathon i can stay a bit late max till 1 am',
      check: (p) => {
        const g = p.tasks.find((t) => /grocer/i.test(t.title))
        if (!g?.start || g.date !== TODAY) return 'groceries should be on today\'s timetable'
        const [h, m] = g.start.split(':').map(Number)
        if (h * 60 + m + g.durationMin > 20 * 60) return `groceries ends after 20:00 (starts ${g.start})`
        if (p.settings.endOfDay !== '25:00') return `end of day should be 25:00 (1 am), got ${p.settings.endOfDay}`
        if (p.tasks.some((t) => t.kind === 'task' && !t.date)) return 'everything should fit by 1 am'
        return null
      },
    },
  ]),
  await scenario('Startly plans a sensible order (errands together, before the shop closes)', [
    {
      at: '16:30',
      say: 'prepare for interview 1h30, finish hackathon project 2h, gym, get groceries',
      check: (p) => {
        const seq = (p.blocks[TODAY] ?? []).filter((b) => b.type === 'task').map((b) => p.tasks.find((t) => t.id === b.taskId)!.title)
        const g = seq.findIndex((t) => /grocer/i.test(t)), gym = seq.findIndex((t) => /gym/i.test(t))
        if (g < 0 || gym < 0) return 'gym and groceries should both be planned'
        if (Math.abs(g - gym) !== 1) return `errands should be next to each other, got ${seq.join(' → ')}`
        return null
      },
    },
    {
      at: '16:32',
      say: 'actually do the hackathon first, it is the most important',
      check: (p) => {
        const first = (p.blocks[TODAY] ?? []).find((b) => b.type === 'task')
        return /hackathon/i.test(p.tasks.find((t) => t.id === first?.taskId)?.title ?? '') ? null : 'the hackathon should now come first'
      },
    },
  ]),
  await scenario('Demo story: started late', [
    {
      at: '13:00',
      say: 'hackathon 2h, gym 1h, apply to 2 jobs, call with mentor at 19:00',
      check: (p) => (onTimetable(p, /hackathon/i) && p.tasks.some((t) => t.kind === 'fixed' && t.start === '19:00') ? null : 'expected hackathon placed and the 19:00 call'),
    },
    {
      at: '16:05',
      say: 'I only started the hackathon at 16:00, it needs 2h',
      check: (p) => (p.tasks.find((t) => /hackathon/i.test(t.title) && !t.partOf)?.start === '16:00' ? null : 'hackathon should start at 16:00'),
    },
  ]),
].reduce((a, b) => a + b, 0)

console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ all real-model checks passed')
process.exit(failures ? 1 : 0)
