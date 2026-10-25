// Real-model conversation checks (costs a few cents). Run: npm run check:real
// Each scenario replays a conversation through the real OpenAI call + the real scheduler,
// and checks what the timetable actually shows — not just that the AI answered.
import { existsSync } from 'node:fs'
import { callAssistant } from '../server/assistant'
import { applyActions, type AnyAction } from '../src/scheduler/applyActions'
import { findQuestion, measureAnswer, type Question } from '../src/scheduler/questions'
import { buildContext } from '../src/lib/api'
import type { ChatMessage, Plan, Profile } from '../src/types'
import { translate } from '../src/i18n'

if (existsSync('.env')) process.loadEnvFile('.env')

const TODAY = '2026-10-17'
type Check = (plan: Plan, reply: string) => string | null // returns a failure message, or null

const fresh = (): Plan => ({ tasks: [], blocks: {}, availability: {}, settings: { lang: 'en', accent: 'iris', theme: null, endOfDay: '23:00' } })
const onTimetable = (p: Plan, re: RegExp) => p.tasks.some((t) => re.test(t.title) && t.date === TODAY && t.start)
const count = (p: Plan, re: RegExp) => p.tasks.filter((t) => re.test(t.title)).length
const startOf = (p: Plan, re: RegExp) => { const t = p.tasks.find((x) => re.test(x.title) && x.date === TODAY && x.start && !x.partOf); return t ? toMinutes(t.start!) : null }
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const show = (p: Plan) =>
  (p.blocks[TODAY] ?? []).map((b) => `${b.start}-${b.end} ${b.taskId ? p.tasks.find((t) => t.id === b.taskId)?.title : b.type}`).join(' | ') +
  (p.tasks.some((t) => !t.date) ? `  [not placed: ${p.tasks.filter((t) => !t.date).map((t) => t.title).join(', ')}]` : '')

async function scenario(name: string, steps: { at: string; say: string; check: Check }[], lang: Plan['settings']['lang'] = 'en', profile?: Profile) {
  let plan: Plan = { ...fresh(), settings: { ...fresh().settings, lang, ...(profile && { profile }) } }
  const messages: ChatMessage[] = []
  type Slots = { ref: string; start: string }[] | null
  let pending: { q: Question; base: AnyAction[]; order: string[] | null; slots: Slots } | null = null
  let failures = 0
  console.log(`\n▶ ${name}`)
  for (const step of steps) {
    const at = new Date(`${TODAY}T${step.at}:00`)
    const nowMin = at.getHours() * 60 + at.getMinutes()
    const forAi = pending && { question: pending.q.text, options: pending.q.options.map(({ id, label }) => ({ id, label })) }
    const t0 = Date.now()
    const res = await callAssistant(step.say, buildContext(plan, messages, forAi, at))
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    let asked = ''
    const resolve = res.actions.find((a) => a.type === 'resolve_pending')
    // Same flow as the app: answering the open question applies that prepared answer.
    const p = pending
    const option = resolve && p?.q.options.find((o) => o.id === resolve.optionId)
    const simulate = (extra: AnyAction[]) => applyActions(plan, [...(p?.base ?? []), ...extra], TODAY, nowMin, p?.order ?? null, p?.slots ?? null)
    const [actions, order, slots]: [AnyAction[], string[] | null, Slots] =
      p && option ? [[...p.base, ...measureAnswer(option.extra, TODAY, simulate)], p.order, p.slots] : [res.actions, res.order, res.slots]
    pending = null
    const run = (extra: AnyAction[] = []) => applyActions(plan, [...actions, ...extra], TODAY, nowMin, order, slots)
    const r = run()
    if (r.applied > 0) {
      const q = findQuestion(plan, r, TODAY, run)
      if (q) {
        asked = `\n        asks: ${translate('en', q.text)} [${q.options.map((o) => translate('en', o.label)).join(' / ')}]`
        pending = { q, base: q.blocking ? actions : [], order: q.blocking ? order : null, slots: q.blocking ? slots : null }
      }
      if (!q?.blocking) plan = r.plan
    }
    messages.push({ id: String(messages.length), role: 'user', text: step.say }, { id: String(messages.length + 1), role: 'assistant', text: res.reply })
    const fail = step.check(plan, res.reply)
    console.log(`  ${step.at} you: ${step.say}\n        startly (${secs}s): ${res.reply}\n        actions: ${res.actions.map((a) => a.type).join(', ') || '—'}   slots: ${res.slots?.length ?? 0}  suggestions: ${res.suggestions?.join(' | ') ?? '—'}${process.env.DEBUG ? `\n        raw: ${JSON.stringify(res.actions)} slots: ${JSON.stringify(res.slots)}` : ''}${asked}\n        timetable: ${show(plan)}\n        ${fail ? `✗ ${fail}` : '✓'}`)
    if (fail) failures++
  }
  return failures
}

const ONLY = process.argv[2] // npm run check:real -- smart  → just the smart-planning scenarios
const failures = ONLY === 'smart' ? await smart() : ONLY === 'brief' ? await brief() : ONLY === 'manual' ? await manual() : [
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
        const end = p.dayEnds?.[TODAY] ?? p.settings.endOfDay
        if (end !== '25:00') return `today should end at 25:00 (1 am), got ${end}`
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
  await scenario('Free time and planning tomorrow', [
    {
      at: '10:00',
      say: 'I work 9 to 5 on weekdays, free after 18:00 until 23:00. Tomorrow (sunday) I am free from 14:00 to 20:00. Plan tomorrow: revise chapter 4 for 2h, laundry, call grandma',
      check: (p) => {
        const sun = '2026-10-18'
        if (JSON.stringify(p.availability.mon) !== JSON.stringify([{ start: '18:00', end: '23:00' }])) return `monday free time should be 18:00–23:00, got ${JSON.stringify(p.availability.mon)}`
        const blocks = p.blocks[sun] ?? []
        if (!blocks.some((b) => b.type === 'task')) return 'sunday should be laid out hour by hour'
        if (blocks.some((b) => b.start < '14:00' || b.end > '20:00')) return 'sunday blocks must stay inside 14:00–20:00'
        if (p.tasks.filter((t) => t.date === sun).length < 3) return 'the 3 tasks should be on sunday'
        return null
      },
    },
  ]),
  await scenario('A late day: Startly asks, you answer in words', [
    {
      at: '19:30',
      say: 'hackathon 2h, then review notes 1h',
      check: (p, reply) => (!onTimetable(p, /review/i) ? 'review notes should fit' : /["“”].+["“”]/.test(reply) ? 'no nudge on a light evening' : null),
    },
    {
      at: '19:40',
      say: 'the hackathon needs one more hour',
      check: (p) => (p.tasks.find((t) => /hack/i.test(t.title))?.durationMin === 120 ? null : 'nothing should change until I answer'),
    },
    {
      at: '19:41',
      say: 'ok keep it, I will stay up',
      check: (p) => (onTimetable(p, /review/i) && p.tasks.some((t) => /hack/i.test(t.title) && t.durationMin === 180) ? null : 'hack should be 3h and review notes still today'),
    },
  ]),
  await scenario('Discipline nudge on a packed day with a late start', [
    {
      at: '09:00',
      say: "I'll start at 12:00 today. I have to apply to 4 jobs, finish the hackathon, revise 3 chapters, gym and groceries",
      check: (_p, reply) => (/["“”].+["“”]/.test(reply) ? null : 'expected a short nudge with a quote'),
    },
  ]),
  await scenario('Asking for breaks between tasks (the AI sees the real timetable)', [
    { at: '19:55', say: "Hey i have interview to prepare and a rag project to create or start at least i don't know with what to start!", check: () => null },
    {
      at: '19:57',
      say: "can you add a break tho i can't do 2 things one after the other!",
      check: (p) => {
        const types = (p.blocks[TODAY] ?? []).map((b) => b.type)
        const i = types.indexOf('task')
        const j = types.indexOf('task', i + 1)
        return i >= 0 && j > i && types.slice(i + 1, j).includes('break') ? null : `expected a break between the two tasks, got ${types.join(', ')}`
      },
    },
  ]),
  await scenario('Writing in French gets a French reply (app language French)', [
    {
      at: '10:00',
      say: "J'ai un entretien à préparer, la salle de sport et les courses aujourd'hui",
      check: (p, reply) =>
        !p.tasks.length ? 'tasks should be added'
        : /\b(je|j'|tu|ton|ta|tes|ai|est|les|des|et|pour|avec|ta journée)\b/i.test(reply) ? null
        : `expected a French reply, got: ${reply}`,
    },
  ], 'fr'),
  await scenario('Demo story: started late', [
    {
      at: '13:00',
      say: 'hackathon 2h, gym 1h, apply to 2 jobs, call with mentor at 19:00',
      check: (p) => {
        if (!onTimetable(p, /hackathon/i) || !p.tasks.some((t) => t.kind === 'fixed' && t.start === '19:00')) return 'expected hackathon placed and the 19:00 call'
        const first = Math.min(...p.tasks.filter((t) => t.kind === 'task' && t.start).map((t) => toMinutes(t.start!)))
        return first <= toMinutes('14:00') ? null : `the first task should start soon after 13:00, not at ${first / 60}h`
      },
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

/** The smart planner: Startly designs the day like a timetable, locks what has a time, and knows how you work. */
async function smart() {
  const h = (hhmm: string) => toMinutes(hhmm)
  return [
    await scenario('A morning person: focus work in the morning, gym in the evening, errands before closing', [
      {
        at: '08:30',
        say: 'math revision 2h, apply to 2 jobs, gym, groceries, read 30 min',
        check: (p) => {
          const math = startOf(p, /math/i), gym = startOf(p, /gym/i), gro = p.tasks.find((t) => /grocer/i.test(t.title))
          if (math === null || math >= h('12:00')) return `math should be in the morning, got ${math}`
          if (gym === null || gym < h('16:00')) return `gym should be late afternoon/evening, got ${gym}`
          if (!gro?.start || h(gro.start) + gro.durationMin > h('20:00')) return 'groceries should end before 20:00'
          return null
        },
      },
    ], 'en', { focusBest: 'morning', habits: '' }),
    await scenario('An evening person: deep work later in the day', [
      {
        at: '09:00',
        say: 'code my side project 2h, laundry, groceries',
        check: (p) => {
          const code = startOf(p, /code|project/i)
          return code !== null && code >= h('16:00') ? null : `deep work should be later in the day for an evening person, got ${code}`
        },
      },
    ], 'en', { focusBest: 'evening', habits: '' }),
    await scenario('Gym at a clock time is locked: running over never moves it', [
      {
        at: '09:00',
        say: 'study 3h, gym at 18:00, groceries',
        check: (p) => (p.tasks.some((t) => /gym/i.test(t.title) && t.kind === 'fixed' && t.start === '18:00') ? null : 'gym should be locked at 18:00'),
      },
      {
        at: '11:00',
        say: 'I need one more hour for studying',
        check: (p, reply) =>
          !p.tasks.some((t) => /gym/i.test(t.title) && t.kind === 'fixed' && t.start === '18:00') ? 'gym should still be at 18:00'
          : /\b(moved|restart|reschedul|start(s|ing)? (it )?now|\d{1,2}:\d{2})/i.test(reply) ? `the reply should only confirm, not describe moves or times: ${reply}`
          : null,
      },
    ]),
    await scenario('Like a school timetable: starting late only moves what has to move', [
      { at: '08:30', say: 'math revision 2h, apply to 2 jobs, gym, groceries', check: () => null },
      {
        at: '10:05',
        say: 'I only started math at 10:00',
        check: (p) => {
          const gym = startOf(p, /gym/i)
          return gym !== null && gym >= h('16:00') ? null : `the evening gym should stay in the evening, got ${gym}`
        },
      },
    ], 'en', { focusBest: 'morning', habits: '' }),
    await scenario('Habits from the profile become fixed blocks on the days they apply', [
      {
        at: '08:00',
        say: 'study 2h and laundry today',
        check: (p) => (p.tasks.some((t) => /gym/i.test(t.title) && t.kind === 'fixed' && t.start === '10:00') ? null : 'the Saturday 10:00 gym habit should be on today'),
      },
    ], 'en', { focusBest: null, habits: 'gym every Saturday at 10:00' }),
    await scenario('Planning a vacation week: Startly asks first, then lays out every day', [
      {
        at: '10:00',
        say: "I'm on vacation next week! I want to work on my portfolio and my RAG project, learn Spanish, and keep going to the gym",
        check: (p, reply) => (p.tasks.length ? `it should ask before planning, but added: ${p.tasks.map((t) => t.title).join(', ')}` : !reply.includes('?') ? 'it should ask a question' : null),
      },
      { at: '10:01', say: 'Mon 19 Oct to Sun 25 Oct', check: () => null },
      { at: '10:02', say: 'dentist wednesday 10am, family dinner friday 8pm', check: () => null },
      { at: '10:03', say: 'my days are 10 to 22, and I want sunday off', check: () => null },
      {
        at: '10:04',
        say: 'sounds good, plan it',
        check: (p) => {
          const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
          const week = days.map((d) => `${d}: ${(p.blocks[d] ?? []).filter((b) => b.taskId).map((b) => `${b.start} ${p.tasks.find((t) => t.id === b.taskId)?.title}`).join(', ')}`).join('\n          ')
          const fixedAt = (re: RegExp, date: string, start: string) => p.tasks.some((t) => re.test(t.title) && t.kind === 'fixed' && t.date === date && t.start === start)
          if (!fixedAt(/dentist/i, '2026-10-21', '10:00')) return `the dentist should be locked Wed 10:00\n          ${week}`
          if (!fixedAt(/dinner/i, '2026-10-23', '20:00')) return `the family dinner should be locked Fri 20:00\n          ${week}`
          const laidOut = days.filter((d) => (p.blocks[d] ?? []).some((b) => b.type === 'task'))
          if (laidOut.length < 5) return `Mon–Sat should be laid out hour by hour, only ${laidOut.length} are\n          ${week}`
          if (p.tasks.some((t) => t.date === '2026-10-25')) return 'Sunday should stay off'
          if (days.some((d) => (p.blocks[d] ?? []).some((b) => b.start < '10:00'))) return `nothing before 10:00\n          ${week}`
          const twice = days.find((d) => {
            const titles = (p.blocks[d] ?? []).filter((b) => b.type === 'task').map((b) => p.tasks.find((t) => t.id === b.taskId)?.title)
            return new Set(titles).size !== titles.length
          })
          if (twice) return `the same task twice on ${twice}\n          ${week}`
          if (p.tasks.some((t) => /monday|tuesday|wednesday|thursday|friday|saturday|sunday|\bday \d/i.test(t.title))) return `titles should not carry the day\n          ${week}`
          if (!(p.blocks['2026-10-19'] ?? []).some((b) => b.type === 'task')) return `Monday should have tasks\n          ${week}`
          const spanish = p.tasks.filter((t) => /spanish/i.test(t.title)).length
          if (spanish < 4 || spanish > 7) return `Spanish should come back most days (got ${spanish})\n          ${week}`
          console.log(`          ${week}`)
          return null
        },
      },
    ]),
    await scenario('It remembers how you work', [
      {
        at: '09:00',
        say: 'btw I focus much better at night, keep that in mind',
        check: (p) => (p.settings.profile?.focusBest === 'evening' ? null : `profile should say evening, got ${JSON.stringify(p.settings.profile)}`),
      },
    ]),
  ].reduce((a, b) => a + b, 0)
}

/** Everyday judgment (outside review, 2026-10-25): what it infers, what it asks, and that its words match the plan. */
async function brief() {
  const h = (hhmm: string) => toMinutes(hhmm)
  const TOMORROW = '2026-10-18'
  const fixed = (p: Plan, re: RegExp) => p.tasks.filter((t) => t.kind === 'fixed' && re.test(t.title))
  const studyBlocks = (p: Plan) => (p.blocks[TODAY] ?? []).filter((b) => /stud/i.test(p.tasks.find((t) => t.id === b.taskId)?.title ?? ''))
  const reserved = (p: Plan) => {
    const b = studyBlocks(p)
    return b.length ? h(b[b.length - 1].end) - h(b[0].start) : 0
  }
  return [
    await scenario('Interview tomorrow: prepare today, no date question, tonight-only bedtime, then a multi-part change', [
      {
        at: '15:00',
        say: 'I have an interview tomorrow; need 3 hours to prepare; gym, laundry, project; bed by 23:00',
        check: (p, reply) => {
          const prep = p.tasks.find((t) => /prep/i.test(t.title) && t.kind === 'task')
          if (!prep) return `the prep should be added, reply: ${reply}`
          if (prep.date !== TODAY) return `the prep should be today, got ${prep.date}`
          if (prep.durationMin !== 180) return `the prep should be 3 h, got ${prep.durationMin}`
          if (fixed(p, /interview/i).some((t) => t.date !== TOMORROW)) return 'an interview block on the wrong day'
          return null
        },
      },
      {
        at: '15:05',
        say: 'I can stay up until 23:30 tonight',
        check: (p) =>
          p.settings.endOfDay !== '23:00' ? `the usual end should stay 23:00, got ${p.settings.endOfDay}`
          : p.dayEnds?.[TODAY] !== '23:30' ? `tonight should end at 23:30, got ${JSON.stringify(p.dayEnds)}`
          : null,
      },
      {
        at: '15:10',
        say: 'Interview moved to 09:00 tomorrow; move gym to tomorrow after 19:00; finish prep today',
        check: (p) => {
          const iv = fixed(p, /interview/i)
          if (iv.length !== 1 || iv[0].date !== TOMORROW || iv[0].start !== '09:00') return `one interview at 09:00 tomorrow, got ${JSON.stringify(iv.map((t) => [t.date, t.start]))}`
          const gym = p.tasks.filter((t) => /gym/i.test(t.title))
          if (gym.length !== 1) return `gym exactly once, got ${gym.length}`
          const g = gym[0]
          if (g.date !== TOMORROW) return `gym should be tomorrow, got ${g.date}`
          const at = g.start ?? g.slot ?? g.preferredStart
          if (!at || h(at) < h('19:00')) return `gym no earlier than 19:00, got ${at}`
          const prep = p.tasks.filter((t) => /prep/i.test(t.title) && t.kind === 'task')
          if (prep.length !== 1 || prep[0].date !== TODAY) return `prep once, today, got ${JSON.stringify(prep.map((t) => t.date))}`
          return null
        },
      },
    ]),
    await scenario('A short window that cannot hold it all: nothing silently shortened', [
      {
        at: '14:30',
        say: 'Plan my day 15:00–20:00. Study 4h, exercise 2h, clean 1h, dinner.',
        check: (p, reply) => {
          const d = (re: RegExp) => p.tasks.find((t) => re.test(t.title))?.durationMin
          if (p.tasks.length && (d(/stud/i) !== 240 || d(/exerc/i) !== 120 || d(/clean/i) !== 60)) return `durations changed: ${p.tasks.map((t) => `${t.title} ${t.durationMin}`).join(', ')}`
          if (p.settings.endOfDay !== '23:00') return `"plan my day until 20:00" is today only, the usual end became ${p.settings.endOfDay}`
          if (p.tasks.length && p.tasks.every((t) => t.date === TODAY && t.start) && (p.dayEnds?.[TODAY] ?? '23:00') <= '20:00') return 'everything placed: impossible'
          if (!p.tasks.length && !reply.includes('?')) return 'neither planned nor asked'
          return null
        },
      },
    ]),
    await scenario('Four hours of study stays one block', [
      {
        at: '09:00',
        say: 'study 4h for my exam, then groceries',
        check: (p) => {
          const study = p.tasks.filter((t) => /stud/i.test(t.title))
          if (study.length !== 1 || study[0].durationMin !== 240) return `one 4 h study task, got ${study.map((t) => t.durationMin).join(', ')}`
          return studyBlocks(p).length === 1 ? null : `one block on the timetable, got ${studyBlocks(p).map((b) => `${b.start}-${b.end}`).join(', ')}`
        },
      },
    ]),
    await scenario('Three hours including breaks', [
      {
        at: '09:00',
        say: 'three hours studying including two ten-minute breaks',
        check: (p, reply) =>
          !p.tasks.length ? (reply.includes('?') ? null : 'neither planned nor asked')
          : p.tasks.length !== 1 ? `one study task, got ${p.tasks.length}`
          : p.settings.breaks ? `breaks between tasks changed: ${JSON.stringify(p.settings.breaks)}`
          : reserved(p) === 180 ? null : `including breaks should reserve 3 h, got ${reserved(p)} min`,
      },
    ]),
    await scenario('Three hours plus breaks', [
      {
        at: '09:00',
        say: 'three hours of focused studying plus two ten-minute breaks',
        check: (p, reply) => (!p.tasks.length ? (reply.includes('?') ? null : 'neither planned nor asked') : reserved(p) >= 200 ? null : `3 h of work plus breaks should reserve 3 h 20, got ${reserved(p)} min`),
      },
    ]),
  ].reduce((a, b) => a + b, 0)
}

/** The user's own manual tests of the outside review (2026-10-25), word for word. */
async function manual() {
  const h = (hhmm: string) => toMinutes(hhmm)
  const TOMORROW = '2026-10-18'
  const on = (p: Plan, date: string, re: RegExp) => (p.blocks[date] ?? []).filter((b) => b.taskId && re.test(p.tasks.find((t) => t.id === b.taskId)?.title ?? ''))
  const asked = (reply: string) => reply.includes('?')
  const noStartQuestion = (reply: string) => (/day start|start your day|your day starts?/i.test(reply) ? `asked when the day starts instead of when they're free: ${reply}` : null)
  return [
    await scenario('Test 1: interview tomorrow morning', [
      {
        at: '16:14',
        say: "I have an interview tomorrow morning 😭 I still need like 3 hours to prepare, I wanna go to the gym for an hour, and I have laundry to do. Can you organize my day? I wanna sleep by 11",
        check: (p) => {
          const prep = on(p, TODAY, /prep|interview/i)
          if (prep.length !== 1 || h(prep[0].end) - h(prep[0].start) !== 180) return 'one 3 h prep block today'
          if (p.tasks.some((t) => t.kind === 'fixed' && /interview/i.test(t.title))) return 'invented an interview time'
          const gym = on(p, TODAY, /gym/i)[0]
          return gym && h(gym.start) < h(prep[0].start) ? 'the gym before the prep' : null
        },
      },
    ]),
    await scenario('Test 2: tonight-only late night, tomorrow back to normal', [
      {
        at: '16:20',
        say: 'I normally sleep at 11 PM but tonight I can stay up until 12:30 AM because I really need to finish my project. Plan 2 hours of work for tonight.',
        check: (p) => (p.settings.endOfDay !== '23:00' ? `usual bedtime changed to ${p.settings.endOfDay}` : p.dayEnds?.[TODAY] !== '24:30' ? `tonight should end 24:30, got ${JSON.stringify(p.dayEnds)}` : null),
      },
      {
        at: '16:22',
        say: "Actually, plan tomorrow evening too. I need an hour to revise and an hour to read. Don't make me stay up late again.",
        check: (p, reply) => {
          if (p.settings.endOfDay !== '23:00' || p.dayEnds?.[TOMORROW]) return `tomorrow should end at 23:00, got ${p.dayEnds?.[TOMORROW] ?? p.settings.endOfDay}`
          if (!on(p, TOMORROW, /revis/i).length && !asked(reply)) return 'neither planned tomorrow nor asked'
          return noStartQuestion(reply) ?? (on(p, TOMORROW, /./).some((b) => b.end > '23:00') ? 'tomorrow runs past 23:00' : null)
        },
      },
    ]),
    await scenario('Test 3: physics including, then plus, breaks', [
      {
        at: '16:20',
        say: 'Tomorrow I want to study physics for 3 hours including two 10-minute breaks. Keep it as one session on my timetable.',
        check: (p, reply) => {
          const ph = p.tasks.filter((t) => /physics/i.test(t.title))
          if (ph.length > 1) return `${ph.length} physics tasks`
          if (ph[0] && ph[0].durationMin !== 180) return `including breaks = 180 min, got ${ph[0].durationMin}`
          if (p.settings.breaks) return 'changed the breaks between tasks'
          return noStartQuestion(reply) ?? (/timer/i.test(reply) ? `claims the timer handles it: ${reply}` : null)
        },
      },
      { at: '16:21', say: 'at 9', check: () => null },
      {
        at: '16:22',
        say: 'Wait actually, I need 3 full hours of studying PLUS those two breaks.',
        check: (p, reply) => {
          const ph = p.tasks.filter((t) => /physics/i.test(t.title))
          if (ph.length !== 1 || ph[0].durationMin !== 200) return `one 200 min physics task, got ${ph.map((t) => t.durationMin).join(', ')}`
          return /timer/i.test(reply) ? `claims the timer handles it: ${reply}` : null
        },
      },
    ]),
    await scenario('Test 4: move the gym to tomorrow after 19:00', [
      { at: '16:25', say: 'Add a gym session today at 8 PM for one hour, and some reading at 9:30 PM for 30 minutes.', check: () => null },
      {
        at: '16:26',
        say: 'Actually move gym to tomorrow after 7 PM. Keep the reading today',
        check: (p) => {
          const gym = p.tasks.filter((t) => /gym/i.test(t.title))
          if (gym.length !== 1) return `gym ${gym.length} times`
          if (on(p, TODAY, /gym/i).length) return 'gym still today'
          const b = on(p, TOMORROW, /gym/i)[0]
          if (!b) return `gym not placed tomorrow (date ${gym[0].date}, start ${gym[0].start})`
          if (h(b.start) < h('19:00')) return `gym tomorrow at ${b.start}, before 19:00`
          return on(p, TODAY, /read/i).length === 1 ? null : 'reading should stay today'
        },
      },
    ]),
    await scenario('Test 5: several changes at once', [
      { at: '16:28', say: 'Tomorrow I have a presentation at 10 AM. I need 2 hours to prepare today, want to work out for an hour tonight, and do 30 minutes of cleaning.', check: () => null },
      {
        at: '16:30',
        say: 'Change of plans! Move my workout to tomorrow evening, make the presentation preparation 3 hours instead of 2, and forget about cleaning. Everything else stays the same.',
        check: (p) => {
          const prep = p.tasks.filter((t) => /prep/i.test(t.title))
          if (prep.length !== 1 || prep[0].durationMin !== 180 || prep[0].date !== TODAY) return `prep once, 180 min, today; got ${JSON.stringify(prep.map((t) => [t.durationMin, t.date]))}`
          if (on(p, TODAY, /prep/i).reduce((m, b) => m + h(b.end) - h(b.start), 0) !== 180) return 'the timetable does not show 3 h of prep'
          if (p.tasks.some((t) => /clean/i.test(t.title))) return 'cleaning still there'
          const pres = p.tasks.filter((t) => t.kind === 'fixed' && /presentation/i.test(t.title))
          if (pres.length !== 1 || pres[0].date !== TOMORROW || pres[0].start !== '10:00') return 'one presentation tomorrow at 10:00'
          const w = p.tasks.filter((t) => /work ?out/i.test(t.title))
          if (w.length !== 1 || w[0].date !== TOMORROW) return 'workout once, tomorrow'
          const b = on(p, TOMORROW, /work ?out/i)[0]
          return b && h(b.start) < h('17:00') ? `"tomorrow evening" placed at ${b.start}` : null
        },
      },
    ]),
    await scenario('Test 6: 18:00–21:00 only, then the shower late', [
      {
        at: '16:35',
        say: "I only have from 6 PM to 9 PM tonight. I need to study for 2 hours, exercise for 1 hour, cook dinner for 45 minutes, and shower for 20 minutes. They're all important, please fit everything in.",
        check: (p, reply) => (on(p, TODAY, /./).some((b) => b.start < '18:00' || b.end > '21:00') ? 'placed outside 18:00–21:00' : p.tasks.length && on(p, TODAY, /./).length === 4 ? 'claims 4h05 fits in 3 h' : !asked(reply) && !p.tasks.some((t) => !t.date) ? 'no question, nothing left out' : null),
      },
      { at: '16:36', say: 'no nevermind i will stay a bit late to shower instead', check: () => null },
      { at: '16:36', say: 'i would say till 00:00 like i will go and sleep at 00:00', check: () => null },
      {
        at: '16:37',
        say: "but no as i said i only have from 6 to 9 for the other takss only the shower should be before i sleep ! like after 23:30 cuz before that i don't have time",
        check: (p, reply) => {
          const out = on(p, TODAY, /stud|exerc|cook|dinner/i).filter((b) => b.start < '18:00' || b.end > '21:00')
          if (out.length) return `outside 18:00–21:00: ${out.map((b) => `${b.start}-${b.end} ${p.tasks.find((t) => t.id === b.taskId)?.title}`).join(', ')}`
          const sh = on(p, TODAY, /shower/i)[0]
          if (sh && sh.start < '23:30') return `shower at ${sh.start}`
          const placed = on(p, TODAY, /stud|exerc|cook|dinner/i).length
          return placed === 3 ? 'claims 3h45 fits in 3 h' : !asked(reply) && !p.tasks.some((t) => !t.date) ? 'nothing said about what does not fit' : null
        },
      },
    ]),
  ].reduce((a, b) => a + b, 0)
}
