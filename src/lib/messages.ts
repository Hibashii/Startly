import { VARIANTS, type CheerStage } from '@/i18n/shared'

// Which cheer, greeting or celebration Startly uses. (The words live in src/i18n, in every language.)

/** The cheer's words follow your progress through the day. */
export function cheerStage(done: number, total: number): CheerStage {
  if (done === 1) return 'first'
  if (total - done === 1) return 'lastOne'
  if (done * 2 >= total && (done - 1) * 2 < total) return 'half'
  return 'any'
}

const last = new Map<string, number>()

/** A random variant slot for one kind of message, never the same as last time for that kind. */
export function pickVariant(kind: string, count: number): number {
  let i = Math.floor(Math.random() * count)
  if (count > 1 && i === last.get(kind)) i = (i + 1) % count
  last.set(kind, i)
  return i
}

export const pickCheer = (stage: CheerStage) => pickVariant(`cheer.${stage}`, VARIANTS.cheer[stage])
export const pickCelebration = () => pickVariant('celebration', VARIANTS.celebration)
