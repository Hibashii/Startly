import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import { HowYouWork } from './HowYouWork'
import type { Accent } from '@/types'
import { LANGS, type Lang } from '@/i18n'
import { useT } from '@/i18n/useT'
import { useStore } from '@/state/store'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/** The "softer" palette: [light, dark] accent for each color. */
export const ACCENTS: { id: Accent; light: string; dark: string }[] = [
  { id: 'iris', light: '#5b5bd6', dark: '#a5a6ff' },
  { id: 'ocean', light: '#0e7490', dark: '#67d3e8' },
  { id: 'sage', light: '#3f7d5c', dark: '#8fd1ac' },
  { id: 'plum', light: '#8e4ec6', dark: '#d2a8ff' },
  { id: 'pink', light: '#d6409f', dark: '#f48cc8' },
  { id: 'coral', light: '#e5484d', dark: '#ff9592' },
  { id: 'ink', light: '#18181b', dark: '#eeeeee' },
]

/** ⋯ in the top bar: language, accent color and Light / Dark, all remembered; How you work; and Start fresh. */
export function SettingsMenu({ theme }: { theme: 'light' | 'dark' }) {
  const accent = useStore((s) => s.settings.accent)
  const setAccent = useStore((s) => s.setAccent)
  const setTheme = useStore((s) => s.setTheme)
  const startFresh = useStore((s) => s.startFresh)
  const setLang = useStore((s) => s.setLang)
  const t = useT()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [work, setWork] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // (Not while a dialog it opened is showing: those live outside the menu.)
    const outside = (e: PointerEvent) => !confirm && !work && !root.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, confirm, work])

  const dark = theme === 'dark'

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t('settings')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className={cn('press grid size-9 cursor-pointer place-items-center rounded-full border bg-card text-ink hover:bg-blk', open && 'bg-blk')}
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('settings')}
          className="menu-in absolute top-[46px] end-0 z-30 w-[260px] origin-top-right rounded-2xl border bg-card p-3.5 shadow-soft rtl:origin-top-left"
        >
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold">{t('language')}</span>
            <span className="relative">
              <select
                value={t.lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                aria-label={t('language')}
                className="cursor-pointer appearance-none rounded-full bg-blk py-1.5 ps-3 pe-7 text-[13px] font-medium text-ink hover:bg-line/70 focus-visible:outline-2 focus-visible:outline-acc"
              >
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronsUpDown className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mut" aria-hidden />
            </span>
          </label>
          <h4 className="m-0 mt-3.5 mb-2.5 border-t pt-3 text-[13px] font-semibold">{t('color')}</h4>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t('color')}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === accent}
                aria-label={t('accent', { accent: a.id })}
                title={t('accent', { accent: a.id })}
                onClick={() => setAccent(a.id)}
                className={cn(
                  'press size-7 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]',
                  a.id === accent && 'outline-2 outline-offset-2 outline-ink',
                )}
                style={{ background: dark ? a.dark : a.light }}
              />
            ))}
          </div>
          <p className="mt-2 mb-0 text-xs text-mut">{t('remembers', { name: t('accent', { accent }) })}</p>
          <div className="mt-3.5 flex items-center justify-between border-t pt-3">
            <span className="text-[13px] font-semibold">{t('darkMode')}</span>
            <Switch on={dark} label={t('darkMode')} onChange={(on) => setTheme(on ? 'dark' : 'light')} />
          </div>
          <div className="mt-3 border-t pt-2">
            <button
              type="button"
              onClick={() => {
                setWork(true)
                setOpen(false)
              }}
              className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-start text-[13px] font-semibold hover:bg-blk"
            >
              {t('howYouWork')}
              <ChevronRight className="size-4 text-mut rtl:rotate-180" aria-hidden />
            </button>
          </div>
          <div className="mt-3 border-t pt-2">
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="-mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 py-1.5 text-start text-[13px] font-semibold text-[#c4363b] hover:bg-blk dark:text-[#ff9592]"
            >
              {t('startFresh')}
            </button>
          </div>
        </div>
      )}
      <HowYouWork
        open={work}
        onClose={() => setWork(false)}
      />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent showCloseButton={false} className="max-w-[380px] rounded-[20px] border bg-card p-6 text-ink">
          <DialogTitle className="text-start text-[18px] font-bold">{t('startFreshTitle')}</DialogTitle>
          <DialogDescription className="text-start text-[14.5px] text-mut">{t('startFreshBody')}</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="press cursor-pointer rounded-full border px-4 py-2 text-sm font-medium hover:bg-blk">
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                startFresh()
                setConfirm(false)
                setOpen(false)
              }}
              className="press cursor-pointer rounded-full bg-[#e5484d] px-4 py-2 text-sm font-semibold text-white"
            >
              {t('deleteEverything')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      dir="ltr"
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-10 cursor-pointer rounded-full bg-line transition-colors', on && 'bg-acc')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
    </button>
  )
}
