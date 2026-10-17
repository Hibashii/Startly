import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useStore } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/useT'
import { PlanningPreview } from './PlanningPreview'


export function FirstScreen() {
  const send = useStore((s) => s.send)
  const thinking = useStore((s) => s.thinking)
  const [text, setText] = useState('')
  const t = useT()
  const [error, setError] = useState<'rate_limited' | 'unavailable' | null>(null)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || thinking) return
    setError(null)
    const res = await send(message)
    if (!res.ok && res.error !== 'busy') setError(res.error === 'rate_limited' ? 'rate_limited' : 'unavailable')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  if (thinking) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[60px]">
        <PlanningPreview dump={text.trim()} />
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-[22px] px-6 pb-[60px] text-center">
      <h1 className="m-0 text-[44px] leading-[1.15] font-semibold tracking-[-0.025em]">
        <span className="font-medium text-[var(--q)]">{t('hookQuestion')}</span>
        <br />
        <span className="highlight">{t('hookAnswer')}</span>
      </h1>
      <ol className="m-0 flex list-none flex-wrap items-center justify-center gap-2.5 p-0">
        {[t('step1'), t('step2'), t('step3')].map((step, i) => (
          <li key={step} className="flex items-center gap-2 text-[15.5px] text-mut">
            {i > 0 && <span className="me-0.5 opacity-50" aria-hidden>{t('stepArrow')}</span>}
            <span className="grid size-6 place-items-center rounded-full bg-blk text-[12.5px] font-bold text-ink">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="mt-2.5 w-full max-w-[720px]">
        <div className="rounded-[28px] border bg-card pt-[18px] pe-4 pb-3.5 ps-[22px] text-start shadow-soft">
          <Textarea
            autoFocus
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('dumpLabel')}
            placeholder={t('dumpPlaceholder')}
            className="max-h-[40vh] min-h-[84px] resize-none border-0 bg-transparent p-1 text-[17px] text-ink shadow-none placeholder:text-mut focus-visible:ring-0 md:text-[17px] dark:bg-transparent"
          />
          <div className="mt-1 flex justify-end">
            <Button
              type="submit"
              disabled={!text.trim()}
              className="press h-auto rounded-full px-5 py-3 text-[15.5px] font-semibold"
            >
              {t('planMyDay')}
            </Button>
          </div>
        </div>
        <p role="alert" className="mt-3 min-h-[1.5em] text-sm text-mut">
          {error && t(error === 'rate_limited' ? 'errRateLimited' : 'errUnavailable')}
        </p>
      </form>
    </main>
  )
}
