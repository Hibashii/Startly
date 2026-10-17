import { useMemo } from 'react'
import { useStore } from '@/state/store'
import { translate, translator, type Name, type Text } from './index'
import { fmtFor } from './format'

/** The current language's translator, for components. */
export function useT() {
  const lang = useStore((s) => s.settings.lang)
  return useMemo(
    () =>
      Object.assign(translator(lang), {
        lang,
        text: (x: Text) => translate(lang, x),
        fmt: fmtFor(lang),
        // A task name: its title, or "X (cont.)" worded in this language.
        taskName: (n: Name) => (typeof n === 'string' ? n : translate(lang, { k: 'continued', p: { title: n.cont } })),
      }),
    [lang],
  )
}
