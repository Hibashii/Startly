import type { ChatMessage as Msg } from '@/types'
import { Avatar } from '@/components/Avatar'

export function ChatMessage({ message }: { message: Msg }) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[82%] self-end rounded-[20px_20px_6px_20px] bg-tint px-[15px] py-[9px] whitespace-pre-wrap text-tinti">
        {message.text}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5" data-role="assistant">
      <Avatar />
      <div className="pt-[3px] whitespace-pre-wrap">{message.text}</div>
    </div>
  )
}
