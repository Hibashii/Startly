import { useStore } from '@/state/store'

/** After a check: a bold pill in your accent color springs up with a line that follows your progress. */
export function Cheer() {
  const cheer = useStore((s) => s.cheer)
  if (!cheer) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-40 flex justify-center" role="status" aria-live="polite">
      <div key={cheer.id} className="cheer-in flex items-center rounded-full bg-acc px-5 py-2.5 text-accink shadow-[0_12px_32px_color-mix(in_srgb,var(--acc)_45%,transparent)]">
        <span className="text-[16px] font-bold tracking-[-0.01em]">{cheer.line}</span>
      </div>
    </div>
  )
}
