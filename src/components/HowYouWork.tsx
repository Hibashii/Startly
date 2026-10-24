import { useEffect, useState } from 'react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n/useT'
import { msg } from '@/i18n'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ProfileFields, type ProfileValue } from './ProfileForm'

/** ⋯ → How you work: the first-time questions again, to change any time. Saved with the button, never while typing. */
export function HowYouWork({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const profile = useStore((s) => s.settings.profile)
  const endOfDay = useStore((s) => s.settings.endOfDay)
  const setProfile = useStore((s) => s.setProfile)
  const current = (): ProfileValue => ({ focusBest: profile?.focusBest ?? null, end: endOfDay, habits: profile?.habits ?? '' })
  const [value, setValue] = useState(current)
  // Each time it opens, it starts from what's saved (Startly may have learned something in the chat meanwhile).
  useEffect(() => {
    if (open) setValue(current())
  }, [open])

  const save = () => {
    setProfile({ ...profile, focusBest: value.focusBest, habits: value.habits.trim() }, value.end)
    toast(t.text(msg('toastSaved')))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] rounded-[24px] border bg-card p-7 text-ink">
        <DialogTitle className="text-start text-[22px] font-semibold tracking-[-0.02em]">{t('howYouWork')}</DialogTitle>
        <DialogDescription className="-mt-1 mb-3 text-start text-[14.5px] text-mut">{t('howYouWorkSub')}</DialogDescription>
        <ProfileFields value={value} onChange={setValue} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="press cursor-pointer rounded-full border px-5 py-2.5 text-sm font-medium hover:bg-blk">
            {t('cancel')}
          </button>
          <button type="button" onClick={save} className="press cursor-pointer rounded-full bg-acc px-5 py-2.5 text-sm font-semibold text-accink">
            {t('save')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
