import type { ReactNode } from 'react'
import type { ChatMessage as Msg } from '@/types'
import { Avatar } from '@/components/Avatar'
import { clock, dateKey, useNow } from '@/lib/time'
import { useStore } from '@/state/store'

/** Startly's question with its answers as buttons (the change waits until one is picked). */
function QuestionButtons({ q }: { q: NonNullable<Msg['question']> }) {
  const pending = useStore((s) => s.pending)
  const answer = useStore((s) => s.answer)
  const today = dateKey(useNow())
  const open = !q.answered && pending?.id === q.pendingId && pending.date === today
  return (
    <div className="mt-2">
      <p className="m-0 font-medium">{q.text}</p>
      {q.answered ? (
        <p className="mt-1.5 mb-0 text-[13px] text-mut">
          {q.answered === 'expired' || q.answered.startsWith('skipped') ? `Question ${q.answered}.` : `You chose: ${q.answered}`}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {q.options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={!open}
              onClick={() => answer(o.id)}
              className={
                i === 0
                  ? 'press cursor-pointer rounded-full bg-acc px-3.5 py-1.5 text-[13.5px] font-semibold text-accink disabled:cursor-default disabled:opacity-40'
                  : 'press cursor-pointer rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium hover:bg-blk disabled:cursor-default disabled:opacity-40'
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
                {clock(m.from)} → {m.to.includes(':') ? clock(m.to) : m.to}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message.notes?.map((n) => (
        <p key={n} className="mt-2 mb-0">{n}</p>
      ))}
      {message.question && <QuestionButtons q={message.question} />}
    </StartlyLine>
  )
}
