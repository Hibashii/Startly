import { useId } from 'react'
import { cn } from '@/lib/utils'

const K = '#1b1b1f' // eyes, headset and bow tie stay dark in both modes

/** Startly, the glossy "Boss": the body gradient follows the accent (--avc), mixed lighter in light mode. */
export function Avatar({ className }: { className?: string }) {
  const g = `av-${useId().replace(/:/g, '')}`
  const stop = (pct: string) => ({ stopColor: `color-mix(in srgb, var(--avc) var(${pct}), #fff)` })
  return (
    <svg viewBox="18 18 88 84" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <defs>
        <radialGradient id={g} cx="35%" cy="30%" r="75%">
          <stop offset="0" style={stop('--av0')} />
          <stop offset=".55" style={stop('--av1')} />
          <stop offset="1" style={stop('--av2')} />
        </radialGradient>
      </defs>
      <rect x="24" y="27" width="72" height="71" rx="26" fill={`url(#${g})`} />
      <ellipse cx="44" cy="41" rx="12" ry="6" fill="#fff" opacity=".5" />
      <circle cx="48" cy="59" r="4.8" fill={K} />
      <circle cx="72" cy="59" r="4.8" fill={K} />
      <circle cx="49.5" cy="57.5" r="1.4" fill="#fff" />
      <circle cx="73.5" cy="57.5" r="1.4" fill="#fff" />
      <ellipse cx="40" cy="69" rx="5" ry="3" fill="#f9a8d4" opacity=".6" />
      <ellipse cx="80" cy="69" rx="5" ry="3" fill="#f9a8d4" opacity=".6" />
      <g fill={K}>
        <rect x="18" y="51" width="13" height="19" rx="5" />
        <rect x="89" y="51" width="13" height="19" rx="5" />
        <circle cx="78" cy="85" r="3.8" />
        <path d="M49 82l11 5.5-11 5.5zM71 82l-11 5.5 11 5.5z" />
        <circle cx="60" cy="87.5" r="3" />
      </g>
      <g stroke={K} fill="none" strokeLinecap="round">
        <path d="M28 58q0-32 32-32t32 32" strokeWidth="5" />
        <path d="M95 70q0 13-15 15" strokeWidth="3.4" />
      </g>
    </svg>
  )
}

/**
 * Startly celebrating: the same "Boss" with arms and legs, happy ^ ^ eyes and a smile.
 * The moves (sway, bounce, waving arms, stepping feet) are CSS classes in index.css.
 */
export function DancingAvatar({ className }: { className?: string }) {
  const g = `avd-${useId().replace(/:/g, '')}`
  const stop = (pct: string) => ({ stopColor: `color-mix(in srgb, var(--avc) var(${pct}), #fff)` })
  const limb = { stroke: `url(#${g})`, strokeWidth: 9, strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="-12 4 144 128" aria-hidden="true" className={cn('dance-sway overflow-visible', className)}>
      <defs>
        <radialGradient id={g} cx="35%" cy="30%" r="75%">
          <stop offset="0" style={stop('--av0')} />
          <stop offset=".55" style={stop('--av1')} />
          <stop offset="1" style={stop('--av2')} />
        </radialGradient>
      </defs>
      <g className="dance-bounce">
        {/* legs and feet, under the body */}
        <g className="dance-leg-l">
          <path d="M48 92 L46 112" {...limb} />
          <ellipse cx="43" cy="115" rx="8" ry="4.5" fill={K} />
        </g>
        <g className="dance-leg-r">
          <path d="M72 92 L74 112" {...limb} />
          <ellipse cx="77" cy="115" rx="8" ry="4.5" fill={K} />
        </g>
        {/* arms, waving up from the shoulders */}
        <g className="dance-arm-l">
          <path d="M28 70 Q12 62 6 46" {...limb} />
          <circle cx="6" cy="44" r="6.5" fill={K} />
        </g>
        <g className="dance-arm-r">
          <path d="M92 70 Q108 62 114 46" {...limb} />
          <circle cx="114" cy="44" r="6.5" fill={K} />
        </g>
        <rect x="24" y="27" width="72" height="71" rx="26" fill={`url(#${g})`} />
        <ellipse cx="44" cy="41" rx="12" ry="6" fill="#fff" opacity=".5" />
        {/* happy closed eyes, then a quick look around */}
        <g stroke={K} strokeWidth="3.6" strokeLinecap="round" fill="none" className="dance-eyes">
          <path d="M42 60 q6 -7 12 0" />
          <path d="M66 60 q6 -7 12 0" />
        </g>
        <path d="M53 70 q7 7 14 0" stroke={K} strokeWidth="3" strokeLinecap="round" fill="none" />
        <ellipse cx="40" cy="69" rx="5" ry="3" fill="#f9a8d4" opacity=".7" />
        <ellipse cx="80" cy="69" rx="5" ry="3" fill="#f9a8d4" opacity=".7" />
        <g fill={K}>
          <rect x="18" y="51" width="13" height="19" rx="5" />
          <rect x="89" y="51" width="13" height="19" rx="5" />
          <circle cx="78" cy="85" r="3.8" />
          <path d="M49 82l11 5.5-11 5.5zM71 82l-11 5.5 11 5.5z" />
          <circle cx="60" cy="87.5" r="3" />
        </g>
        <g stroke={K} fill="none" strokeLinecap="round">
          <path d="M28 58q0-32 32-32t32 32" strokeWidth="5" />
          <path d="M95 70q0 13-15 15" strokeWidth="3.4" />
        </g>
      </g>
    </svg>
  )
}
