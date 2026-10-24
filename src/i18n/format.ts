import type { Lang } from './langs'
import type { Name } from './shared'

/** Locale-aware formatting handed to every message: weekdays, dates, lists, quotes, durations and task names. */
export interface Fmt extends BaseFmt {
  name: (n: Name) => string // "Work", or "Work (cont.)" / "Work (suite)" for the rest of a split task
}

export interface BaseFmt {
  weekday: (date: string) => string // "Sunday" / "dimanche" / "الأحد"
  weekdayShort: (date: string) => string // "Sun"
  dayMonth: (date: string) => string // "Saturday 17 October"
  list: (items: string[]) => string // "A, B and C" / "A, B et C"
  quote: (s: string) => string // 'A' / « A » / „A“
  duration: (min: number) => string // "1h30" / "1 h 30" / "45 min"
  monthYear: (date: string) => string // "October 2026"
  range: (from: string, to: string) => string // "26 Oct – 1 Nov"
}

// Latin digits everywhere (Arabic included), so times and durations read the same in every language.
// English uses day-month order ("Saturday 17 October"), like the rest of Startly's design.
const locale = (lang: Lang) => (lang === 'ar' ? 'ar-u-nu-latn' : lang === 'en' ? 'en-GB' : lang)
// Noon avoids a date shifting across midnight in any time zone.
const at = (date: string) => new Date(`${date}T12:00:00`)

const QUOTES: Record<Lang, (s: string) => string> = {
  en: (s) => `'${s}'`,
  fr: (s) => `« ${s} »`,
  es: (s) => `«${s}»`,
  de: (s) => `„${s}“`,
  nl: (s) => `‘${s}’`,
  ar: (s) => `«${s}»`,
}

/** Compact durations in each language ("1h30", "1 h 30", "45 Min.", "45 د"). */
const DURATION: Record<Lang, (h: number, m: number) => string> = {
  en: (h, m) => (!h ? `${m}m` : m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`),
  fr: (h, m) => (!h ? `${m} min` : m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
  es: (h, m) => (!h ? `${m} min` : m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
  de: (h, m) => (!h ? `${m} Min.` : m ? `${h} Std. ${m} Min.` : `${h} Std.`),
  nl: (h, m) => (!h ? `${m} min` : m ? `${h} u ${String(m).padStart(2, '0')}` : `${h} u`),
  ar: (h, m) => (!h ? `${m} د` : m ? `${h} س ${m} د` : `${h} س`),
}

const cache = new Map<Lang, BaseFmt>()

export function fmtFor(lang: Lang): BaseFmt {
  const hit = cache.get(lang)
  if (hit) return hit
  const loc = locale(lang)
  const weekday = new Intl.DateTimeFormat(loc, { weekday: 'long' })
  const weekdayShort = new Intl.DateTimeFormat(loc, { weekday: 'short' })
  const dayMonth = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' })
  const list = new Intl.ListFormat(loc, { style: 'long', type: 'conjunction' })
  const monthYear = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' })
  const dayShort = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' })
  const fmt: BaseFmt = {
    weekday: (d) => weekday.format(at(d)),
    weekdayShort: (d) => weekdayShort.format(at(d)),
    dayMonth: (d) => dayMonth.format(at(d)),
    list: (items) => list.format(items),
    quote: QUOTES[lang],
    duration: (min) => DURATION[lang](Math.floor(min / 60), min % 60),
    monthYear: (d) => monthYear.format(at(d)),
    range: (a, b) => dayShort.formatRange(at(a), at(b)),
  }
  cache.set(lang, fmt)
  return fmt
}

/** "Saturday, 17 October" for the top bar, from a real Date. */
export const longDate = (lang: Lang, d: Date) =>
  new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
