import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'

/** A fixed appointment (set time, Startly never moves it), said in a word: clearer than an icon. Takes the color around it. */
export function FixedTag({ className }: { className?: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-current/25 px-1.5 text-[10.5px] leading-[15px] font-medium opacity-70',
        className,
      )}
    >
      {t('fixedTag')}
    </span>
  )
}
