import type { Fmt } from './format'
import type { Accent } from '@/types'
import { variant, type CheerStage, type DayPart, type Name } from './shared'

// The source of truth for every sentence Startly's code writes. Other languages must match these keys
// and parameters exactly (TypeScript checks it). A value is a string, or a function of its parameters
// and the locale's formatting helpers.
// Keys are saved in the chat history (as { k, p }), so renaming or removing one needs a store migration.


const GREETINGS: Record<DayPart, string[]> = {
  morning: ['Good morning ☀️', 'Good morning! New day, fresh start.', 'Morning! Ready when you are.'],
  afternoon: ['Good afternoon!', 'Hi again! Here for the rest of your day.'],
  evening: ['Good evening!', 'Evening! Let’s make the most of what’s left.'],
}
const CHEERS: Record<CheerStage, string[]> = {
  first: ['Great start! 🚀', 'First one down 🎯', "And we're off 🏁", 'Momentum: unlocked ⚡️'],
  half: ['Halfway there 💪', 'Half the day, done 🔥', "You're over the hump 🏔️"],
  lastOne: ['One more to go 🔥', "Last one. You've got this 💪", 'Final stretch 🏁'],
  any: ['Nice! One down 🎉', 'You ran that one 💪', 'Keep the momentum ✨', 'Done and dusted ✅', 'Look at you go 🙌', 'On a roll 🔥', "That's how it's done ⚡️"],
}
const CELEBRATIONS = [
  ['You cooked today. Every box checked. Go rest, you deserve it.', 'Discipline is choosing between what you want now and what you want most.'],
  ['Everything done. You started, and you finished. That was the hard part.', 'Either you run the day or the day runs you.'],
  ['Be proud of the version of you who showed up today.', 'Small daily improvements are the key to staggering long-term results.'],
  ["All done. Tomorrow you'll thank today's you.", 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.'],
  ['Every single box. Take the evening, it’s yours.', 'The secret of getting ahead is getting started.'],
]
const s = (n: number, one: string, many: string) => (n === 1 ? one : many)

export const en = {
  // First screen
  hookQuestion: "Don't know where to start?",
  hookAnswer: 'Start here.',
  step1: 'Dump everything',
  step2: 'Get your timetable',
  step3: 'Tell me when things change',
  stepArrow: '→',
  dumpLabel: 'Tell me everything you have to do',
  dumpPlaceholder: 'Tell me everything you have to do…',
  planMyDay: 'Plan my day →',
  planning1: 'Reading your list…',
  planning2: 'Spotting fixed times…',
  planning3: 'Choosing a good order…',
  planning4: 'Adding lunch and breaks…',
  planning5: 'Building your timetable…',

  // Top bar and settings
  askStartly: 'Ask Startly',
  weekToggle: (p: { date: string; open: boolean }, f: Fmt) => `${f.dayMonth(p.date)}: ${p.open ? 'hide' : 'show'} the week`,
  settings: 'Settings',
  color: 'Color',
  accent: (p: { accent: Accent }) =>
    ({ iris: 'Iris', ocean: 'Ocean', sage: 'Sage', plum: 'Plum', pink: 'Pink', coral: 'Coral', ink: 'Ink' })[p.accent],
  remembers: (p: { name: string }) => `${p.name} · Startly remembers your choice.`,
  darkMode: 'Dark mode',
  language: 'Language',
  startFresh: 'Start fresh…',
  startFreshTitle: 'Start fresh?',
  startFreshBody:
    "This deletes your plan, your chat and your free times, and takes you back to the first screen. Your preferences stay (color, mode, language, end of day, breaks). It can't be undone.",
  cancel: 'Cancel',
  deleteEverything: 'Delete everything',

  // Week strip
  thisWeek: 'This week',
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekDay: (p: { date: string; planned: string | null; pinned: boolean }, f: Fmt) =>
    `${f.dayMonth(p.date)}: ${p.planned ? `${p.planned} planned` : 'nothing planned'}${p.pinned ? ', fixed appointment' : ''}`,

  // Timetable
  dayComplete: 'Day complete ✓',
  plannedUntil: (p: { planned: string; until: string }) => `${p.planned} planned · until ${p.until}`,
  nothingPlanned: 'Nothing planned yet',
  freeTime: (p: { windows: string[] }, f: Fmt) => `Free ${f.list(p.windows)}`,
  freeUnknown: 'Free time unknown',
  planned: (p: { planned: string }) => `${p.planned} planned`,
  view: 'View',
  viewList: 'List',
  viewGrid: 'Grid',
  timetableOf: (p: { day: string }) => `${p.day}'s timetable`,
  todaysTimetable: "Today's timetable",
  tasksOf: (p: { day: string }) => `${p.day}'s tasks`,
  laterDayHint: "I'll lay this day out hour by hour when it comes, or ask me to plan it now.",
  laterDayEmpty: 'Nothing planned for this day yet.',
  noFitBefore: (p: { end: string }) => `Doesn't fit before ${p.end}`,
  noFitToday: "Doesn't fit today",
  noFitOn: (p: { day: string }) => `Doesn't fit on ${p.day}`,
  lunch: 'Lunch',
  break: 'Break',
  hourGrid: 'Hour grid',
  now: 'Now',
  fixedAppointment: 'fixed appointment',

  // Task card
  doneLabel: (p: { title: string }) => `Done: ${p.title}`,
  nowLeft: (p: { left: string }) => `Now · ${p.left} left`,
  didYouFinish: 'Did you finish?',
  btnDone: '✓ Done',
  needMoreTime: 'Need more time',
  notStarted: 'Not started',
  toTomorrow: '→ Tomorrow',
  skipToTomorrow: 'Skip to tomorrow',
  clickToRename: 'Click to rename',
  renameLabel: (p: { title: string }) => `Rename ${p.title}`,
  continued: (p: { title: string }) => `${p.title} (cont.)`,

  // Chat
  chatWithStartly: 'Chat with Startly',
  clearChat: 'Clear chat',
  clearChatHint: 'Clear chat (your plan stays)',
  closeChat: 'Close chat',
  rearranging: 'Rearranging your day…',
  messageLabel: 'Message Startly',
  messagePlaceholder: 'Message Startly…',
  send: 'Send',
  retry: 'Retry',
  whatMoved: 'What moved',
  notToday: 'not today',
  errRateLimited: "That's a lot of messages for one hour. Give me a few minutes.",
  errUnavailable: "I couldn't reach my brain just now. Try again?",
  didntGet: "Sorry, I didn't quite get that. Could you say it another way?",
  answerWithButtons: 'You can answer with the buttons above.',
  youChose: (p: { answer: string }) => `You chose: ${p.answer}`,
  questionExpired: 'Question expired.',
  questionSkipped: 'Question skipped (you changed something else).',
  questionLater: "I'll ask again in a moment.",
  nAdded: (p: { n: number }) => `${p.n} added`,
  chooseLegend: 'Choose which to add to today',
  addSelected: 'Add selected · drop the rest',
  backToEarlier: 'Back to the earlier question:',

  // Code-written notes under Startly's replies
  noteRemoved: (p: { items: Name[] }, f: Fmt) => `Removed: ${f.list(p.items.map(f.name))}.`,
  notePutOn: (p: { title: Name; date: string; due: string }, f: Fmt) =>
    `Put ${f.quote(f.name(p.title))} on ${f.weekday(p.date)}, since it's due ${f.weekday(p.due)}.`,
  noteWhenFree: (p: { date: string; waiting: Name[] }, f: Fmt) =>
    `When are you free on ${f.weekday(p.date)}?` +
    (p.waiting.length ? ` I'd like to fit ${f.list(p.waiting.map((x) => f.quote(f.name(x))))} in before it's due.` : " Tell me and I'll plan it."),
  notePlanned: (p: { dates: string[] }, f: Fmt) => `Planned ${f.list(p.dates.map(f.weekday))} hour by hour.`,
  noteNoFitToday: (p: { end: string; items: Name[] }, f: Fmt) => `These don't fit before ${p.end} today: ${f.list(p.items.map(f.name))}.`,
  noteNoFitOn: (p: { date: string; items: Name[] }, f: Fmt) => `These don't fit on ${f.weekday(p.date)}: ${f.list(p.items.map(f.name))}.`,

  // Startly asks
  qUntil: (p: { until: string; title: Name; date: string }, f: Fmt) =>
    `That puts you until ${p.until}. OK, or should I move ${f.quote(f.name(p.title))} to ${f.weekday(p.date)}?`,
  keepIt: 'Keep it',
  moveIt: 'Move it',
  qNoFit: (p: { items: Name[]; end: string; stay: string | null; date: string }, f: Fmt) => {
    const one = p.items.length === 1
    const ways = [p.stay ? `stay until ${p.stay}` : null, `move ${s(p.items.length, 'it', 'them')} to ${f.weekday(p.date)}`, `drop ${one ? 'it' : 'them'}`]
      .filter((x): x is string => !!x)
    const choice = ways.slice(0, -1).join(', ') + ', or ' + ways.at(-1)
    return `${f.list(p.items.map((x) => f.quote(f.name(x))))} ${one ? "doesn't" : "don't"} fit before ${p.end}. ${choice[0].toUpperCase()}${choice.slice(1)}?`
  },
  stayUntil: (p: { until: string }) => `Stay until ${p.until}`,
  dayOption: (p: { date: string }, f: Fmt) => f.weekday(p.date),
  dropIt: 'Drop it',
  dropThem: 'Drop them',

  // A new day
  greeting: (p: { part: DayPart; i: number; hasPlan: boolean }) =>
    `${variant(GREETINGS[p.part], p.i)} ${p.hasPlan ? 'Your plan is still here.' : "What's on today? Tell me everything and I'll plan it."}`,
  leftoverOne: (p: { title: string; yesterday: boolean }, f: Fmt) =>
    `${f.quote(f.name(p.title))} from ${p.yesterday ? 'yesterday' : 'earlier'} wasn't checked. Add it to today?`,
  leftoverMany: (p: { items: string[]; yesterday: boolean }, f: Fmt) =>
    `${p.items.length} things from ${p.yesterday ? 'yesterday' : 'earlier'} weren't checked: ${f.list(p.items.map(f.name))}. Add them to today?`,
  addIt: 'Add it',
  addBoth: 'Add both',
  addAll: 'Add all',
  choose: 'Choose',

  // Replies to the Now card's buttons
  addedMore: (p: { title: Name }, f: Fmt) => `Added 30 min to ${f.quote(f.name(p.title))}.`,
  startsNow: (p: { title: Name }, f: Fmt) => `OK, ${f.quote(f.name(p.title))} starts now.`,
  movedTo: (p: { title: Name; date: string }, f: Fmt) => `Moved ${f.quote(f.name(p.title))} to ${f.weekday(p.date)}.`,
  addedToToday: 'Added to today.',
  droppedThem: 'Dropped them.',

  // Toasts and rewards
  toastReshuffled: (p: { n: number }) => `↻ Reshuffled ${p.n} ${s(p.n, 'task', 'tasks')}`,
  toastRemoved: (p: { items: Name[] }, f: Fmt) => `✓ Removed ${f.list(p.items.map(f.name))}`,
  toastAdded: (p: { n: number }) => `✓ Added ${p.n} ${s(p.n, 'task', 'tasks')}`,
  toastRenamed: '✓ Renamed',
  toastChatCleared: '✓ Chat cleared',
  cheer: (p: { stage: CheerStage; i: number }) => variant(CHEERS[p.stage], p.i),
  dayCompleteTitle: 'Day complete',
  celebrationMessage: (p: { i: number }) => variant(CELEBRATIONS, p.i)[0],
  celebrationQuote: (p: { i: number }) => variant(CELEBRATIONS, p.i)[1],
  restWell: 'Rest well',
}
