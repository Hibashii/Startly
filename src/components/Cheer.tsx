import { useStore } from '@/state/store'

/** After a check: a bold pill in your accent color springs up, with how far along the day you are. */
export function Cheer() {
  const cheer = useStore((s) => s.cheer)
  if (!cheer) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-40 flex justify-center" role="status" aria-live="polite">
      <div key={cheer.id} className="cheer-in flex flex-col items-center gap-1.5 rounded-[22px] bg-acc px-5 pt-2.5 pb-2 text-accink shadow-[0_12px_32px_color-mix(in_srgb,var(--acc)_45%,transparent)]">
        <span className="text-[16px] font-bold tracking-[-0.01em]">{cheer.line}</span>
        {cheer.total > 1 && (
          <span className="flex items-center gap-2 text-[12px] font-semibold opacity-90">
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: Math.min(cheer.total, 12) }, (_, i) => (
                <span
                  key={i}
                  className={i < cheer.done ? 'dot-pop size-2 rounded-full bg-current' : 'size-2 rounded-full bg-current opacity-30'}
                  style={i === cheer.done - 1 ? { animationDelay: '180ms' } : { animation: 'none' }}
                />
              ))}
            </span>
            {cheer.done} of {cheer.total} done
          </span>
        )}
      </div>
    </div>
  )
}
