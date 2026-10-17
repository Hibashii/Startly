// Everything Startly says that's written by code, not the AI.

export const ERRORS: Record<string, string> = {
  rate_limited: "That's a lot of messages for one hour. Give me a few minutes.",
  unavailable: "I couldn't reach my brain just now. Try again?",
}

/** Short, varied pop-ups when a task is checked. */
export const ENCOURAGEMENTS = [
  'Nice! One down 🎉',
  'Done. Keep the momentum ✨',
  "That's one less thing on your mind.",
  'Checked. On to the next one 💪',
  'Look at you go 🙌',
  'Progress, not perfection. Well done.',
  'Another one done ✅',
]

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
