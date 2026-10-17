import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'

const STEPS = [
  'Reading your list…',
  'Spotting fixed times…',
  'Choosing a good order…',
  'Adding lunch and breaks…',
  'Building your timetable…',
]

// Ghost rows: [width of the name, is it a break]
const GHOSTS: [string, boolean][] = [['46%', false], ['20%', true], ['58%', false], ['34%', false], ['20%', true], ['40%', false]]

/** Shown while Startly plans the first day: what it's doing, and a timetable assembling itself. */
export function PlanningPreview({ dump }: { dump: string }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="planning w-full max-w-[720px] text-left" role="status" aria-live="polite">
      <p className="m-0 line-clamp-3 rounded-[20px] border bg-card px-5 py-3.5 text-[15px] text-mut shadow-soft">{dump}</p>

      <div className="mt-6 flex items-center gap-3">
        <Avatar className="breathe size-9" />
        <span key={step} className="status-line text-[15.5px] font-medium">
          {STEPS[step]}
        </span>
      </div>

      <ol className="m-0 mt-4 list-none p-0" aria-hidden>
        {GHOSTS.map(([width, rest], i) => (
          <li
            key={i}
            className={`ghost my-1.5 flex items-center gap-3.5 rounded-xl px-4 ${rest ? 'h-9 border border-dashed' : 'shimmer h-11 bg-blk'}`}
            style={{ animationDelay: `${150 + i * 120}ms` }}
          >
            {!rest && <span className="size-[17px] rounded-[5px] bg-line/70" />}
            <span className="h-2.5 w-[84px] rounded-full bg-line/70" />
            <span className="h-2.5 rounded-full bg-line/70" style={{ width }} />
          </li>
        ))}
      </ol>
    </div>
  )
}
