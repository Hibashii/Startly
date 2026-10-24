import { en } from './en'
import { fr } from './fr'
import { es } from './es'
import { de } from './de'
import { nl } from './nl'
import { ar } from './ar'
import { fmtFor, type Fmt } from './format'
import type { Lang } from './langs'

export type { Lang } from './langs'
export { LANGS, detectLang, dirOf, isLang } from './langs'
export { nameOf, type Name } from './shared'

/** Every language has exactly the keys and parameters of English. */
export type Dict = { [K in keyof typeof en]: (typeof en)[K] }
export type Key = keyof Dict

/** The parameters a message takes (never: a plain string). */
export type ParamsOf<K extends Key> = Dict[K] extends (p: infer P, f: Fmt) => string ? P : never

/**
 * A sentence to show, stored as data: which message, with which values (task titles, times, dates).
 * Code that decides *what* to say (the scheduler, the store) returns these; only the screen turns them
 * into words, so a language switch re-renders everything, chat history included.
 */
export type Text = { [K in Key]: ParamsOf<K> extends never ? { k: K } : { k: K; p: ParamsOf<K> } }[Key]

export function msg<K extends Key>(k: K, ...p: ParamsOf<K> extends never ? [] : [ParamsOf<K>]): Text {
  return (p.length ? { k, p: p[0] } : { k }) as Text
}

const DICTS: Record<Lang, Dict> = { en, fr, es, de, nl, ar }

/** The language's formatting, plus task names: "the rest of X" is worded by that language's `continued`. */
function fmtWithNames(d: Dict, lang: Lang): Fmt {
  const base = fmtFor(lang)
  const f: Fmt = { ...base, name: (n) => (typeof n === 'string' ? n : d.continued({ title: n.cont })) }
  return f
}

/**
 * The words for a message. Saved chats hold message keys, so this never crashes on old or odd data:
 * an unknown language falls back to English, an unknown key shows nothing (and warns), and a message
 * that fails in one language is shown in English.
 */
export function translate(lang: Lang, text: Text): string {
  const dict: Dict = DICTS[lang] ?? en
  const render = (d: Dict, l: Lang) => {
    const entry = d[text.k]
    return typeof entry === 'function' ? (entry as (p: unknown, f: Fmt) => string)('p' in text ? text.p : undefined, fmtWithNames(d, l)) : entry
  }
  if (!text || !(text.k in en)) {
    console.warn('[i18n] unknown message', text)
    return ''
  }
  try {
    return render(dict, DICTS[lang] ? lang : 'en')
  } catch {
    try {
      return render(en, 'en')
    } catch {
      return ''
    }
  }
}

/** A translator bound to a language: t('askStartly'), t('plannedUntil', { planned, until }). */
export function translator(lang: Lang) {
  return <K extends Key>(k: K, ...p: ParamsOf<K> extends never ? [] : [ParamsOf<K>]) => translate(lang, msg(k, ...p))
}
export type T = ReturnType<typeof translator>
