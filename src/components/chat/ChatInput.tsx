import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { useStore } from '@/state/store'

export function ChatInput() {
  const send = useStore((s) => s.send)
  const thinking = useStore((s) => s.thinking)
  const [text, setText] = useState('')

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const message = text.trim()
    if (!message || thinking) return
    setText('')
    await send(message)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  return (
    <form
      onSubmit={submit}
      className="mx-3.5 mb-3.5 flex min-w-[280px] items-end gap-2.5 rounded-[26px] border bg-card py-[7px] pr-[7px] pl-[18px] shadow-soft"
    >
      <textarea
        rows={1}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Message Startly"
        placeholder="Message Startly…"
        className="field-sizing-content max-h-40 min-h-[34px] flex-1 resize-none bg-transparent py-[7px] text-[14.5px] text-ink outline-none placeholder:text-mut"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!text.trim() || thinking}
        className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-full bg-acc text-accink disabled:cursor-default disabled:opacity-40"
      >
        <ArrowUp className="size-4" strokeWidth={2.4} />
      </button>
    </form>
  )
}
