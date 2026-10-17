import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChatMessage as Msg } from '@/types'
import type { Text } from '@/i18n'
import { Avatar } from '@/components/Avatar'
import { clock } from '@/lib/time'
import { useDay, useStore } from '@/state/store'
import { useT } from '@/i18n/useT'

/** Startly's question with its answers as buttons (the change waits until one is picked). */
function QuestionButtons({ q }: { q: NonNullable<Msg['question']> }) {
  const pending = useStore((s) => s.pending)
  const answer = useStore((s) => s.answer)
  const answerChoose = useStore((s) => s.answerChoose)
  const { today } = useDay()
  const t = useT()
  const open = !q.answered && pending?.id === q.pendingId && pending.date === today
  const [choosing, setChoosing] = useState(false)
  const [picked, setPicked] = useState<string[]>(() => q.choose?.map((c) => c.id) ?? [])
  const firstBox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (choosing) firstBox.current?.focus() // keyboard users keep their place
  }, [choosing])

  return (
    <div className="mt-2">
      <p className="m-0 font-medium">{t.text(q.text)}</p>
      {q.answered ? (
        <p className="mt-1.5 mb-0 text-[13px] text-mut">{answeredLine(q.answered, t)}</p>
      ) : choosing && q.choose ? (
        <div className="mt-2">
          <fieldset className="m-0 grid gap-1.5 border-0 p-0">
            <legend className="sr-only">{t('chooseLegend')}</legend>
            {q.choose.map((c, i) => (
              <div key={c.id}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    ref={i === 0 ? firstBox : undefined}
                    type="checkbox"
                    className="size-4 accent-[var(--acc)]"
                    checked={picked.includes(c.id)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))}
                  />
                  {c.title}
                </label>
              </div>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={!open}
            onClick={() => answerChoose(picked)}
            className="press mt-2.5 cursor-pointer rounded-full bg-acc px-3.5 py-1.5 text-[13.5px] font-semibold text-accink disabled:opacity-40"
          >
            {t('addSelected')}
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {q.options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={!open}
              onClick={() => (o.id === 'choose' && q.choose ? setChoosing(true) : answer(o.id))}
              className={
                i === 0
                  ? 'press cursor-pointer rounded-full bg-acc px-3.5 py-1.5 text-[13.5px] font-semibold text-accink disabled:cursor-default disabled:opacity-40'
                  : 'press cursor-pointer rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium hover:bg-blk disabled:cursor-default disabled:opacity-40'
              }
            >
              {t.text(o.label)}
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
      className="max-w-[82%] self-end rounded-[20px_20px_6px_20px] bg-tint px-[15px] py-[9px] whitespace-pre-wrap text-tinti data-[faded=true]:opacity-60 rtl:rounded-[20px_20px_20px_6px]"
      dir="auto"
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
  if (message.role === 'user') return <UserBubble>{'text' in message ? message.text : null}</UserBubble>
  return <StartlyMessage message={message} />
}

/** How an answered question reads afterwards: the answer you picked, or why it closed. */
function answeredLine(answered: Text, t: ReturnType<typeof useT>) {
  const closed: Text['k'][] = ['questionExpired', 'questionSkipped', 'questionLater']
  return closed.includes(answered.k) ? t.text(answered) : t('youChose', { answer: t.text(answered) })
}

function StartlyMessage({ message }: { message: Msg }) {
  const t = useT()
  // Where a task went: a time ("16:15"), a later day ("Sun"), or not today.
  const target = (to: string | null) => (to === null ? t('notToday') : to.includes(':') ? clock(to) : t.fmt.weekdayShort(to))
  return (
    <StartlyLine>
      {'content' in message ? (
        <p className="m-0 whitespace-pre-wrap">{t.text(message.content)}</p>
      ) : (
        // The AI's own words may be in another language than the app's: let them set their own direction.
        <p className="m-0 whitespace-pre-wrap" dir="auto">{message.text}</p>
      )}
      {message.moved && (
        <ul className="my-2 grid list-none gap-1 p-0" aria-label={t('whatMoved')}>
          {message.moved.map((m) => (
            <li key={(m.id ?? '') + m.from} className="flex justify-between gap-3 text-sm">
              {t.taskName(m.title)}
              <span className="text-[13px] text-mut tabular-nums" dir="ltr">
                {clock(m.from)} → {target(m.to)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message.notes?.map((n, i) => (
        <p key={i} className="mt-2 mb-0">{t.text(n)}</p>
      ))}
      {message.question && <QuestionButtons q={message.question} />}
    </StartlyLine>
  )
}
