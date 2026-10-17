// What every dictionary shares: the kinds of variable messages, and how a variant is chosen.

export type DayPart = 'morning' | 'afternoon' | 'evening'
export type CheerStage = 'first' | 'half' | 'lastOne' | 'any'

/**
 * How many variants each language writes for the messages that vary (cheers, greetings, celebrations).
 * Every dictionary has exactly these counts (checked by the i18n tests), so a variant number means the
 * same slot in every language and "never twice in a row" holds after a language switch too.
 */
export const VARIANTS = {
  cheer: { first: 4, half: 3, lastOne: 3, any: 7 },
  greeting: { morning: 3, afternoon: 2, evening: 2 },
  celebration: 5,
} as const

/** A task's name in a message: its title, or "the rest of X" for a split task (each language words it). */
export type Name = string | { cont: string }
export const nameOf = (task: { title: string; partOf?: string }): Name => (task.partOf ? { cont: task.title } : task.title)

/** The variant at slot `i` (wrapping around). */
export const variant = <T>(items: readonly T[], i: number): T => items[Math.abs(i) % items.length]
