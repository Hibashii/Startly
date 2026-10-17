import { Pin } from 'lucide-react'
import type { Block, Task } from '@/types'
import { clock, formatDuration, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'

export function TaskCard({ block, task, flash, enterDelay }: { block: Block; task?: Task; flash?: boolean; enterDelay?: number }) {
  const rest = block.type === 'lunch' || block.type === 'break'
  const done = task?.status === 'done'
  const name = rest ? (block.type === 'lunch' ? 'Lunch' : 'Break') : (task?.title ?? '')

  return (
    <li
      data-type={block.type}
      className={cn(
        'my-1.5 grid min-h-11 grid-cols-[18px_112px_1fr_auto] items-center gap-3.5 rounded-xl bg-blk px-4 py-[11px]',
        rest && 'min-h-9 border border-dashed bg-transparent py-[7px] text-mut',
        done && 'opacity-60',
        flash && 'flash',
        enterDelay !== undefined && 'enter',
      )}
      style={enterDelay !== undefined ? { animationDelay: `${enterDelay}ms` } : undefined}
      data-flash={flash || undefined}
    >
      {rest ? <span /> : <span className="size-[17px] rounded-[5px] border-[1.5px] border-mut" aria-hidden />}
      <time className="text-sm whitespace-nowrap text-mut tabular-nums">
        {clock(block.start)}–{clock(block.end)}
      </time>
      <span className={cn('flex items-center gap-1.5', rest ? 'font-normal' : 'font-medium', done && 'text-mut line-through')}>
        {name}
        {block.type === 'fixed' && <Pin className="size-3.5 text-mut" aria-label="fixed appointment" />}
      </span>
      <span className="text-[13px] text-mut">{rest ? '' : formatDuration(toMin(block.end) - toMin(block.start))}</span>
    </li>
  )
}
