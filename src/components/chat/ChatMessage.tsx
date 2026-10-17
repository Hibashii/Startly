import type { ReactNode } from 'react'
import type { ChatMessage as Msg } from '@/types'
import { Avatar } from '@/components/Avatar'

export function UserBubble({ children, faded }: { children: ReactNode; faded?: boolean }) {
  return (
    <div
      className="max-w-[82%] self-end rounded-[20px_20px_6px_20px] bg-tint px-[15px] py-[9px] whitespace-pre-wrap text-tinti data-[faded=true]:opacity-60"
      data-faded={faded}
    >
      {children}
    </div>
  )
}

export function StartlyLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5" data-role="assistant">
      <Avatar />
      <div className="min-w-0 flex-1 pt-[3px]">{children}</div>
    </div>
  )
}

export function ChatMessage({ message }: { message: Msg }) {
  if (message.role === 'user') return <UserBubble>{message.text}</UserBubble>

  return (
    <StartlyLine>
      <p className="m-0 whitespace-pre-wrap">{message.text}</p>
      {message.moved && (
        <ul className="my-2 grid list-none gap-1 p-0" aria-label="What moved">
          {message.moved.map((m) => (
            <li key={m.title + m.from} className="flex justify-between gap-3 text-sm">
              {m.title}
              <span className="text-[13px] text-mut tabular-nums">
                {m.from} → {m.to}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message.notes?.map((n) => (
        <p key={n} className="mt-2 mb-0">{n}</p>
      ))}
    </StartlyLine>
  )
}
