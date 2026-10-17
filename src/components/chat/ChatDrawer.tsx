import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/state/store'
import { Avatar } from '@/components/Avatar'
import { ERRORS } from '@/lib/messages'
import { cn } from '@/lib/utils'
import { ChatMessage, StartlyLine, UserBubble } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function ChatDrawer() {
  const open = useStore((s) => s.chatOpen)
  const setOpen = useStore((s) => s.setChatOpen)
  const messages = useStore((s) => s.chat.messages)
  const thinking = useStore((s) => s.thinking)
  const failed = useStore((s) => s.failed)
  const send = useStore((s) => s.send)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, open, thinking, failed])

  return (
    <aside
      aria-label="Chat with Startly"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'flex w-[40%] max-w-[440px] flex-none flex-col overflow-hidden border-l bg-panel transition-[width,max-width,visibility] duration-300 ease-out',
        !open && 'invisible w-0 max-w-0 border-0',
      )}
    >
      <div className="flex h-[54px] flex-none items-center gap-[9px] border-b px-[18px] font-semibold whitespace-nowrap">
        <Avatar className="size-[26px]" />
        Startly
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full text-mut hover:bg-blk"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-w-[300px] flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-5 text-[14.5px] leading-[1.55]">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {thinking && (
          <StartlyLine>
            <span className="inline-flex items-center gap-2.5 pt-1" role="status">
              <span className="inline-flex gap-1" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-mut" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span className="status-line text-[13.5px] text-mut">Rearranging your day…</span>
            </span>
          </StartlyLine>
        )}
        {failed && !thinking && (
          <>
            <UserBubble faded>{failed.text}</UserBubble>
            <StartlyLine>
              <p className="m-0">{ERRORS[failed.error]}</p>
              <button
                type="button"
                onClick={() => send(failed.text)}
                className="mt-2 cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium hover:bg-blk"
              >
                Retry
              </button>
            </StartlyLine>
          </>
        )}
        <div ref={end} />
      </div>
      <ChatInput />
    </aside>
  )
}
