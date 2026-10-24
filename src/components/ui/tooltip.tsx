import type { ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

export const TipProvider = TooltipPrimitive.Provider

/**
 * A small dark label on hover (and keyboard focus) that says what a button does, or shows a cut-off name in full.
 * The child must take a ref: a button, or a span around something disabled (a disabled button gets no hover).
 */
export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!label) return children
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="tip-in z-50 max-w-[260px] rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] leading-snug font-medium text-bg shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
