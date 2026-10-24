import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, LoaderCircle } from 'lucide-react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import type { VoiceEnd } from '@/lib/useVoice'
import { CancelVoice, MicButton, StopVoice, Waveform, appendHeard, useVoiceInput } from './VoiceButton'

export function ChatInput({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const send = useStore((s) => s.send)
  const thinking = useStore((s) => s.thinking)
  const t = useT()
  const [text, setText] = useState('')
  const spoken = useRef(false) // some of the words in the box came from the mic
  const field = useRef<HTMLTextAreaElement>(null)

  const voice = useVoiceInput(heard)
  const talking = voice.state !== 'idle'

  function heard(words: string, end: VoiceEnd) {
    const all = appendHeard(text, words)
    // ↑ while Startly is still answering the last message: the words wait in the box instead.
    if (end === 'send' && !useStore.getState().thinking) {
      setText('')
      spoken.current = false
      send(all, true)
      return
    }
    spoken.current = true
    setText(all)
    requestAnimationFrame(() => field.current?.focus())
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || thinking) return
    setText('')
    const fromMic = spoken.current
    spoken.current = false
    await send(message, fromMic)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'mx-3.5 mb-3.5 flex min-w-[280px] items-end gap-2.5 rounded-[26px] border bg-card py-[7px] pe-[7px] ps-[18px] shadow-soft',
        talking && 'items-center ps-[7px]',
        className,
      )}
    >
      {talking ? (
        <>
          <CancelVoice voice={voice} />
          <Waveform voice={voice} />
          <StopVoice voice={voice} />
          <button
            type="button"
            onClick={voice.send}
            disabled={voice.state !== 'recording'}
            aria-label={t('send')}
            className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-full bg-acc text-accink disabled:cursor-default"
          >
            {voice.ending === 'send' ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.4} />}
          </button>
        </>
      ) : (
        <>
          <textarea
            ref={field}
            rows={1}
            autoFocus={autoFocus}
            maxLength={4000}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (!e.target.value.trim()) spoken.current = false
            }}
            onKeyDown={onKeyDown}
            aria-label={t('messageLabel')}
            placeholder={t('messagePlaceholder')}
            dir="auto"
            className="field-sizing-content max-h-40 min-h-[34px] flex-1 resize-none bg-transparent py-[7px] text-[14.5px] text-ink outline-none placeholder:text-mut"
          />
          <MicButton voice={voice} />
          <button
            type="submit"
            aria-label={t('send')}
            disabled={!text.trim() || thinking}
            className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-full bg-acc text-accink disabled:cursor-default disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} />
          </button>
        </>
      )}
    </form>
  )
}
