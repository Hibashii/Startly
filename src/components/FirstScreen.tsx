import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useStore } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const STEPS = ['Dump everything', 'Get your timetable', 'Tell me when things change']

export const ERRORS: Record<string, string> = {
  rate_limited: "That's a lot of messages for one hour. Give me a few minutes.",
  unavailable: "I couldn't reach my brain just now. Try again?",
}

export function FirstScreen() {
  const send = useStore((s) => s.send)
  const thinking = useStore((s) => s.thinking)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || thinking) return
    setError(null)
    const res = await send(message)
    if (!res.ok && res.error !== 'busy') setError(ERRORS[res.error ?? 'unavailable'])
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-[22px] px-6 pb-[60px] text-center">
      <h1 className="m-0 text-[44px] leading-[1.15] font-semibold tracking-[-0.025em]">
        <span className="font-medium text-[var(--q)]">Don't know where to start?</span>
        <br />
        <span className="highlight">Start here.</span>
      </h1>
      <ol className="m-0 flex list-none flex-wrap items-center justify-center gap-2.5 p-0">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2 text-[15.5px] text-mut">
            {i > 0 && <span className="mr-0.5 opacity-50" aria-hidden>→</span>}
            <span className="grid size-6 place-items-center rounded-full bg-blk text-[12.5px] font-bold text-ink">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="mt-2.5 w-full max-w-[720px]">
        <div className="rounded-[28px] border bg-card pt-[18px] pr-4 pb-3.5 pl-[22px] text-left shadow-soft">
          <Textarea
            autoFocus
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={thinking}
            aria-label="Tell me everything you have to do"
            placeholder="Tell me everything you have to do…"
            className="max-h-[40vh] min-h-[84px] resize-none border-0 bg-transparent p-1 text-[17px] text-ink shadow-none placeholder:text-mut focus-visible:ring-0 md:text-[17px] dark:bg-transparent"
          />
          <div className="mt-1 flex justify-end">
            <Button
              type="submit"
              disabled={!text.trim() || thinking}
              className="h-auto rounded-full px-5 py-3 text-[15.5px] font-semibold"
            >
              {thinking ? 'Planning…' : 'Plan my day →'}
            </Button>
          </div>
        </div>
        <p role="alert" className="mt-3 min-h-[1.5em] text-sm text-mut">{error}</p>
      </form>
    </main>
  )
}
