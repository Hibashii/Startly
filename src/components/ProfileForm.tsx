import type { ReactNode } from 'react'
import type { Profile } from '@/types'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

/** When your day ends: shown as a clock time, stored like the scheduler counts ("01:00" tonight = "25:00"). */
const END_TIMES = [['22:00', '22:00'], ['23:00', '23:00'], ['00:00', '24:00'], ['01:00', '25:00']] as const

export interface ProfileValue {
  focusBest: Profile['focusBest']
  end: string
  habits: string
}

/** How you work: asked before the first plan, and changed any time from ⋯ → How you work. */
export function ProfileFields({ value, onChange }: { value: ProfileValue; onChange: (v: ProfileValue) => void }) {
  const t = useT()
  const set = (part: Partial<ProfileValue>) => onChange({ ...value, ...part })
  return (
    <>
      <Question label={t('obFocus')}>
        {(['morning', 'afternoon', 'evening'] as const).map((f) => (
          <Chip key={f} on={value.focusBest === f} onClick={() => set({ focusBest: value.focusBest === f ? null : f })}>
            {t(f === 'morning' ? 'obMorning' : f === 'afternoon' ? 'obAfternoon' : 'obEvening')}
          </Chip>
        ))}
      </Question>
      <Question label={t('obEnd')}>
        {END_TIMES.map(([shown, stored]) => (
          <Chip key={stored} on={value.end === stored} onClick={() => set({ end: stored })}>
            <span dir="ltr" className="tabular-nums">{shown}</span>
          </Chip>
        ))}
      </Question>
      <label className="mb-7 block">
        <span className="mb-2.5 block text-[15px] font-semibold">{t('obHabits')}</span>
        <input
          value={value.habits}
          onChange={(e) => set({ habits: e.target.value })}
          maxLength={300}
          placeholder={t('obHabitsHint')}
          className="w-full rounded-xl border bg-card px-4 py-3 text-[15px] text-ink placeholder:text-mut focus-visible:outline-2 focus-visible:outline-acc"
        />
      </label>
    </>
  )
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 mb-6 border-0 p-0">
      <legend className="mb-2.5 p-0 text-[15px] font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>{children}</div>
    </fieldset>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn('press cursor-pointer rounded-full border px-4 py-2 text-[14.5px] hover:bg-blk', on && 'border-ink bg-ink font-medium text-bg hover:bg-ink')}
    >
      {children}
    </button>
  )
}
