import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useStore } from '@/state/store'
import type { VoiceEnd } from '@/lib/useVoice'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/useT'
import { PlanningPreview } from './PlanningPreview'
import { ProfileFields, type ProfileValue } from './ProfileForm'
import { ChatThread } from './chat/ChatThread'
import { ChatInput } from './chat/ChatInput'
import { CancelVoice, MicButton, StopVoice, Waveform, appendHeard, useVoiceInput } from './chat/VoiceButton'


export function FirstScreen() {
  const send = useStore((s) => s.send)
  const thinking = useStore((s) => s.thinking)
  const known = useStore((s) => !!s.settings.profile)
  // Startly answered with a question (which days? when are you free?) and there's no plan yet:
  // the conversation stays here in the middle until the plan exists, then the main screen takes over.
  const talking = useStore((s) => s.chat.messages.some((m) => m.role === 'assistant'))
  const [asking, setAsking] = useState(false)
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const spoken = useRef(false) // some of the words in the box came from the mic
  const t = useT()
  const [error, setError] = useState<'rate_limited' | 'unavailable' | null>(null)

  const voice = useVoiceInput(heard)
  function heard(words: string, end: VoiceEnd) {
    const all = appendHeard(text, words)
    spoken.current = true
    setText(all)
    if (end === 'send') submit(undefined, all)
    else requestAnimationFrame(() => field.current?.focus())
  }

  async function submit(e?: FormEvent, said?: string) {
    e?.preventDefault()
    const message = (said ?? text).trim()
    if (!message || thinking) return
    // The first time: a few quick questions about how you work, before planning.
    if (!useStore.getState().settings.profile) return setAsking(true)
    setError(null)
    const res = await send(message, spoken.current)
    if (!res.ok && res.error !== 'busy') setError(res.error === 'rate_limited' ? 'rate_limited' : 'unavailable')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  if (asking && !known && !thinking) return <Questions onDone={() => submit()} />

  if (talking) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-6">
        <div className="planning flex min-h-0 w-full max-w-[680px] flex-1 flex-col" role="region" aria-label={t('chatWithStartly')}>
          <ChatThread className="pb-5 text-[16px] leading-[1.6]" />
          <ChatInput autoFocus className="mx-0 mb-0 py-[9px] text-[16px]" />
        </div>
      </main>
    )
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
      <h1 className="m-0 text-[40px] leading-[1.15] font-[650] tracking-[-0.03em] text-balance sm:text-[50px]">
        <span className="block font-medium text-[var(--q)]">{t('hookQuestion')}</span>
        {/* Balanced, so a phone splits it in two even lines instead of leaving one word alone */}
        <span className="block"><span className="highlight">{t('hookAnswer')}</span></span>
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
          {voice.state === 'idle' ? (
            <>
              <Textarea
                ref={field}
                autoFocus
                maxLength={4000}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  if (!e.target.value.trim()) spoken.current = false
                }}
                onKeyDown={onKeyDown}
                aria-label={t('dumpLabel')}
                placeholder={t('dumpExample')}
                className="max-h-[40vh] min-h-[84px] resize-none border-0 bg-transparent p-1 text-[17px] text-ink shadow-none placeholder:text-mut focus-visible:ring-0 md:text-[17px] dark:bg-transparent"
              />
              <div className="mt-1 flex items-center justify-end gap-2">
                <MicButton voice={voice} className="size-11" />
                <Button
                  type="submit"
                  disabled={!text.trim()}
                  className="press h-auto rounded-full px-5 py-3 text-[15.5px] font-semibold"
                >
                  {t('planMyDay')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Same height as the text box, so the card doesn't jump */}
              <div className="flex min-h-[84px] items-center">
                <Waveform voice={voice} className="h-12" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <CancelVoice voice={voice} className="size-11" />
                <StopVoice voice={voice} className="ms-auto size-11" />
                <Button
                  type="button"
                  onClick={voice.send}
                  disabled={voice.state !== 'recording'}
                  className="press h-auto rounded-full px-5 py-3 text-[15.5px] font-semibold disabled:opacity-100"
                >
                  {voice.ending === 'send' ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {t('planMyDay')}
                </Button>
              </div>
            </>
          )}
        </div>
        <p role="alert" className="mt-3 min-h-[1.5em] text-sm text-mut">
          {error && t(error === 'rate_limited' ? 'errRateLimited' : 'errUnavailable')}
        </p>
      </form>
    </main>
  )
}

/** Asked once, before the first plan: when you focus best, when your day ends, what happens at fixed times. */
function Questions({ onDone }: { onDone: () => void }) {
  const t = useT()
  const setProfile = useStore((s) => s.setProfile)
  const endNow = useStore((s) => s.settings.endOfDay)
  const [value, setValue] = useState<ProfileValue>({ focusBest: null, end: endNow, habits: '' })
  const finish = (skip: boolean) => {
    setProfile(skip ? { focusBest: null, habits: '' } : { focusBest: value.focusBest, habits: value.habits.trim() }, skip ? undefined : value.end)
    onDone()
  }
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[60px]">
      <div className="planning w-full max-w-[560px]">
        <h1 className="m-0 text-[28px] font-semibold tracking-[-0.02em]">{t('obTitle')}</h1>
        <p className="mt-2 mb-7 text-[15px] text-mut">{t('obSub')}</p>
        <ProfileFields value={value} onChange={setValue} />
        {/* (A phone: the main button full width, Skip under it: the two don't fit side by side in every language.) */}
        <div className="flex justify-end gap-2 max-sm:flex-col-reverse max-sm:gap-1">
          <button type="button" onClick={() => finish(true)} className="press cursor-pointer rounded-full px-5 py-3 text-[15px] font-medium text-mut hover:bg-blk">
            {t('obSkip')}
          </button>
          <Button type="button" onClick={() => finish(false)} className="press h-auto rounded-full px-5 py-3 text-[15.5px] font-semibold">
            {t('planMyDay')}
          </Button>
        </div>
      </div>
    </main>
  )
}
