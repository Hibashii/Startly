export const LANGS = [
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'fr', name: 'Français', dir: 'ltr' },
  { id: 'es', name: 'Español', dir: 'ltr' },
  { id: 'de', name: 'Deutsch', dir: 'ltr' },
  { id: 'nl', name: 'Nederlands', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
] as const

export type Lang = (typeof LANGS)[number]['id']

export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x)
export const dirOf = (lang: Lang) => LANGS.find((l) => l.id === lang)!.dir

/** The first of the browser's languages that Startly speaks, else English. */
export function detectLang(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'en'
}
