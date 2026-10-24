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
      // A wide screen: a panel beside the timetable. A phone or small tablet: a sheet over it, under the top bar
      // (and its menus), sliding in from the side.
      className={cn(
        'fixed inset-x-0 top-[60px] bottom-0 z-[25] flex flex-col overflow-hidden bg-panel transition-[translate,visibility] duration-300 ease-out',
        'md:static md:z-auto md:w-[40%] md:max-w-[440px] md:flex-none md:border-s md:transition-[width,max-width,visibility]',
        !open && 'invisible translate-x-full rtl:-translate-x-full md:w-0 md:max-w-0 md:translate-x-0 md:border-0',
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
