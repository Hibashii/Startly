import { Eraser, X } from 'lucide-react'
import { Tip } from '../ui/tooltip'
import { useStore } from '@/state/store'
import { Avatar } from '@/components/Avatar'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { ChatThread } from './ChatThread'
import { ChatInput } from './ChatInput'

export function ChatDrawer({ arriving }: { arriving?: boolean }) {
  const open = useStore((s) => s.chatOpen)
  const setOpen = useStore((s) => s.setChatOpen)
  const messages = useStore((s) => s.chat.messages)
  const thinking = useStore((s) => s.thinking)
  const clearChat = useStore((s) => s.clearChat)
  const t = useT()

  return (
    <aside
      aria-label={t('chatWithStartly')}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'flex w-[40%] max-w-[440px] flex-none flex-col overflow-hidden border-s bg-panel transition-[width,max-width,visibility] duration-300 ease-out',
        !open && 'invisible w-0 max-w-0 border-0',
        arriving && open && 'chat-arrive', // from the middle of the first screen to its place
      )}
    >
      <div className="flex h-[54px] flex-none items-center gap-[9px] border-b px-[18px] font-semibold whitespace-nowrap">
        <Avatar className="size-[26px]" />
        Startly
        <Tip label={t('clearChatHint')} side="bottom">
          <span className="ms-auto">
            <button
              type="button"
              onClick={clearChat}
              disabled={!messages.length || thinking}
              aria-label={t('clearChat')}
              className="grid size-8 cursor-pointer place-items-center rounded-full text-mut hover:bg-blk disabled:cursor-default disabled:opacity-30"
            >
              <Eraser className="size-4" />
            </button>
          </span>
        </Tip>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('closeChat')}
          className="grid size-8 cursor-pointer place-items-center rounded-full text-mut hover:bg-blk"
        >
          <X className="size-4" />
        </button>
      </div>
      <ChatThread className="min-w-[300px] px-[18px] py-5 text-[14.5px] leading-[1.55]" />
      <ChatInput />
    </aside>
  )
}
