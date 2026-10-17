import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Accent } from '@/types'
import { useStore } from '@/state/store'
import { cn } from '@/lib/utils'

/** The "softer" palette: [light, dark] accent for each color. */
export const ACCENTS: { id: Accent; name: string; light: string; dark: string }[] = [
  { id: 'iris', name: 'Iris', light: '#5b5bd6', dark: '#a5a6ff' },
  { id: 'ocean', name: 'Ocean', light: '#0e7490', dark: '#67d3e8' },
  { id: 'sage', name: 'Sage', light: '#3f7d5c', dark: '#8fd1ac' },
  { id: 'plum', name: 'Plum', light: '#8e4ec6', dark: '#d2a8ff' },
  { id: 'coral', name: 'Coral', light: '#e5484d', dark: '#ff9592' },
  { id: 'ink', name: 'Ink', light: '#18181b', dark: '#eeeeee' },
]

/** ⋯ in the top bar: the accent color and Light / Dark. Both are remembered. */
export function SettingsMenu({ theme }: { theme: 'light' | 'dark' }) {
  const accent = useStore((s) => s.settings.accent)
  const setAccent = useStore((s) => s.setAccent)
  const setTheme = useStore((s) => s.setTheme)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const dark = theme === 'dark'
  const current = ACCENTS.find((a) => a.id === accent)!

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Settings"
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
          aria-label="Settings"
          className="menu-in absolute top-[46px] right-0 z-30 w-[260px] origin-top-right rounded-2xl border bg-card p-3.5 shadow-soft"
        >
          <h4 className="m-0 mb-2.5 text-[13px] font-semibold">Color</h4>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Color">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === accent}
                aria-label={a.name}
                title={a.name}
                onClick={() => setAccent(a.id)}
                className={cn(
                  'press size-[30px] cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]',
                  a.id === accent && 'outline-2 outline-offset-2 outline-ink',
                )}
                style={{ background: dark ? a.dark : a.light }}
              />
            ))}
          </div>
          <p className="mt-2 mb-0 text-xs text-mut">{current.name} · Startly remembers your choice.</p>
          <div className="mt-3.5 flex items-center justify-between border-t pt-3">
            <span className="text-[13px] font-semibold">Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Dark mode"
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              className={cn('relative h-6 w-10 cursor-pointer rounded-full bg-line transition-colors', dark && 'bg-acc')}
            >
              <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', dark && 'translate-x-4')} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
