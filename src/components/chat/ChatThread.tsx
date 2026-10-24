import { useEffect, useRef } from 'react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { ChatMessage, StartlyLine, UserBubble } from './ChatMessage'

/** The conversation itself: messages, "thinking…", and a retry when a message didn't go through. Used by the chat panel and the first-run conversation. */
export function ChatThread({ className }: { className?: string }) {
  const open = useStore((s) => s.chatOpen)
  const messages = useStore((s) => s.chat.messages)
  const thinking = useStore((s) => s.thinking)
  const failed = useStore((s) => s.failed)
  const send = useStore((s) => s.send)
  const t = useT()
  const end = useRef<HTMLDivElement>(null)
  const latestChange = messages.findLast((m) => m.moved)?.id

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, open, thinking, failed])

  return (
    <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto', className)}>
      {messages.map((m, i) => (
        <ChatMessage key={m.id} message={m} last={i === messages.length - 1 && !thinking} latestChange={m.id === latestChange} />
      ))}
      {thinking && (
        <StartlyLine>
          <span className="inline-flex items-center gap-2.5 pt-1" role="status">
            <span className="inline-flex gap-1" aria-hidden>
              {[0, 150, 300].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-mut" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
            <span className="status-line text-[13.5px] text-mut">{t('thinking')}</span>
          </span>
        </StartlyLine>
      )}
      {failed && !thinking && (
        <>
          <UserBubble faded>{failed.text}</UserBubble>
          <StartlyLine>
            <p className="m-0">{t(failed.error === 'rate_limited' ? 'errRateLimited' : 'errUnavailable')}</p>
            <button
              type="button"
              onClick={() => send(failed.text)}
              className="mt-2 cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium hover:bg-blk"
            >
              {t('retry')}
            </button>
          </StartlyLine>
        </>
      )}
      <div ref={end} />
    </div>
  )
}
