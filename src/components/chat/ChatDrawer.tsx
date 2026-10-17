import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/state/store'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { ChatMessage } from './ChatMessage'

export function ChatDrawer() {
  const open = useStore((s) => s.chatOpen)
  const setOpen = useStore((s) => s.setChatOpen)
  const messages = useStore((s) => s.chat.messages)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, open])

  return (
    <aside
      aria-label="Chat with Startly"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'flex w-[40%] max-w-[440px] flex-none flex-col overflow-hidden border-l bg-panel transition-[width,max-width] duration-300 ease-out',
        !open && 'w-0 max-w-0 border-0',
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
        <div ref={end} />
      </div>
    </aside>
  )
}
