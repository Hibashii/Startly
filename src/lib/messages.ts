// Everything Startly says that's written by code, not the AI.

export const ERRORS: Record<string, string> = {
  rate_limited: "That's a lot of messages for one hour. Give me a few minutes.",
  unavailable: "I couldn't reach my brain just now. Try again?",
}

/** The cheer when a task is checked: the words follow your progress through the day. */
const CHEERS = {
  first: ['Great start! 🚀', 'First one down 🎯', "And we're off 🏁", 'Momentum: unlocked ⚡️'],
  half: ['Halfway there 💪', 'Half the day, done 🔥', "You're over the hump 🏔️"],
  lastOne: ['One more to go 🔥', "Last one. You've got this 💪", 'Final stretch 🏁'],
  any: ['Nice! One down 🎉', 'You ran that one 💪', 'Keep the momentum ✨', 'Done and dusted ✅', 'Look at you go 🙌', 'On a roll 🔥', "That's how it's done ⚡️"],
}

export function cheerLine(done: number, total: number) {
  if (done === 1) return pick(CHEERS.first)
  if (total - done === 1) return pick(CHEERS.lastOne)
  if (done * 2 >= total && (done - 1) * 2 < total) return pick(CHEERS.half)
  return pick(CHEERS.any)
}

/** When every task of the day is checked: a touching message and a discipline quote. */
export const CELEBRATIONS = [
  { message: 'You cooked today. Every box checked. Go rest, you deserve it.', quote: 'Discipline is choosing between what you want now and what you want most.' },
  { message: 'Everything done. You started, and you finished. That was the hard part.', quote: 'Either you run the day or the day runs you.' },
  { message: 'Be proud of the version of you who showed up today.', quote: 'Small daily improvements are the key to staggering long-term results.' },
  { message: "All done. Tomorrow you'll thank today's you.", quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.' },
  { message: 'Every single box. Take the evening, it’s yours.', quote: 'The secret of getting ahead is getting started.' },
]

let last = -1
/** A random item, never the same twice in a row. */
export function pick<T>(items: T[]): T {
  let i = Math.floor(Math.random() * items.length)
  if (items.length > 1 && i === last) i = (i + 1) % items.length
  last = i
  return items[i]
}
