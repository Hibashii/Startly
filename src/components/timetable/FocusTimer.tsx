import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, BellOff, Check, ChevronDown, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useDay, useStore } from '@/state/store'
import { useT } from '@/i18n/useT'
import { clock, now } from '@/lib/time'
import { cn } from '@/lib/utils'
import { playPause, playRoundDone, playStart, ring, unlockSound } from '@/lib/sound'
import { askNotifications, notify } from '@/lib/notify'
import { countdown, phaseKey, shouldRing, timerView } from '@/scheduler/timer'
import { taskTitle } from './taskTitle'
import { msg, type Text } from '@/i18n'
import confetti from 'canvas-confetti'
import { DancingAvatar } from '@/components/Avatar'
import { Tip } from '@/components/ui/tooltip'

/** Re-renders every second while mounted. */
function useTick() {
  const [ms, setMs] = useState(() => now().getTime())
  useEffect(() => {
    const tick = () => setMs(now().getTime())
    // Ticked from a worker: browsers slow a background tab's own timers down (Chrome: once a minute after
    // 5 minutes hidden), not a worker's, so the bell and the notifications stay on time in another tab.
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 1000)'], { type: 'text/javascript' }))
      const worker = new Worker(url)
      URL.revokeObjectURL(url)
      worker.onmessage = tick
      return () => worker.terminate()
    } catch {
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }
  }, [])
  return ms
}

/** What the focus timer shows right now, for today. */
function useTimerView() {
  const nowMs = useTick()
  const { today } = useDay()
  const blocks = useStore((s) => s.blocks[today])
  const tasks = useStore((s) => s.tasks)
  const timer = useStore((s) => s.timer)
  const mode = useStore((s) => s.settings.timerMode ?? 'normal')
  const focusDay = useStore((s) => s.focusDay)
  const dayStartMs = new Date(`${today}T00:00:00`).getTime()
  return timerView(blocks ?? [], tasks, timer, mode, nowMs, dayStartMs, focusDay === today)
}

let lastClick = 0
/** Every timer button: no bell right after a click (you did it yourself), and its own little sound if it has one. */
const clicked = (fn: () => void, sound?: () => void) => () => {
  lastClick = Date.now()
  askNotifications() // the first timer click: may Startly notify you when you're in another tab?
  unlockSound() // the bell may only ring after a click
  if (sound && useStore.getState().settings.timerSound !== false) sound()
  fn()
}

/** Always mounted: rings when time moves you on, Startly pops up after a focus round, and the countdown sits in the browser tab. */
export function TimerBell() {
  const view = useTimerView()
  const tasks = useStore((s) => s.tasks)
  const sound = useStore((s) => s.settings.timerSound ?? true)
  const showPop = useStore((s) => s.showPop)
  const t = useT()
  const prev = useRef<string | null>(null)
  const key = phaseKey(view)
  const task = view && tasks.find((x) => x.id === view.block.taskId)

  useEffect(() => {
    const before = prev.current
    prev.current = key
    // (Not on first load, and not after a click: the button already did what you asked.)
    if (before === null || !shouldRing(before, key) || Date.now() - lastClick < 1500) return
    if (key.startsWith('b:')) {
      // A Pomodoro focus round is over: a happy sound, and Startly says well done.
      const n = Number(before.split(':')[2]) || 1
      if (sound) playRoundDone()
      showPop(msg('roundDone', { n, i: Math.floor(Math.random() * 3) }))
    } else if (sound) ring()

    // The same moment as a notification, for when you're in another tab or app.
    const name = task ? taskTitle(task, t) : ''
    if (view?.kind === 'pomoBreak') notify(t('notifBreakTitle'), t('notifBreakBody', { time: clockAt(view.backAtMs) }), true)
    else if (key.startsWith('e:')) notify(t('notifUpTitle'), t('notifUpBody', { title: name }))
    else if (before.startsWith('b:') && name) notify(t('notifBackTitle'), t('notifTask', { title: name }), true)
    else if (before.startsWith('r:') && name) notify(t('notifNextTitle', { title: name }), t('notifNextBody'))
  }, [key, sound, showPop])

  const title =
    view?.kind === 'focus' || view?.kind === 'pomoBreak'
      ? `${view.pausedForMs !== undefined ? '⏸ ' : ''}${countdown(view.leftMs)} · ${view.kind === 'focus' && task ? taskTitle(task, t) : t('shortBreak')}`
      : view?.kind === 'ended'
        ? `⏰ ${t('timesUp')}`
        : view?.kind === 'next' && view.rest
          ? `${countdown(view.rest.leftMs)} · ${t('breakTime')}`
          : 'Startly'
  useEffect(() => {
    document.title = title
  }, [title])
  useEffect(() => () => void (document.title = 'Startly'), [])
  return null
}

/** A Pomodoro round done: the page blurs, confetti bursts from behind Startly, who dances across and leaves. A click ends it early. */
export function StartlyPop() {
  const pop = useStore((s) => s.pop)
  if (!pop) return null
  return <Party key={pop.id} line={pop.line} />
}

function Party({ line }: { line: Text }) {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvas.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const fire = confetti.create(canvas.current, { resize: true })
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()
    const colors = [acc, '#fbbf24', '#f472b6', '#34d399', '#60a5fa']
    // When Startly reaches the middle: a burst from behind, then two side sprays.
    const timers = [
      setTimeout(() => fire({ particleCount: 90, spread: 100, startVelocity: 38, origin: { x: 0.5, y: 0.5 }, colors, scalar: 0.9 }), 520),
      setTimeout(() => {
        fire({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0.35, y: 0.6 }, colors })
        fire({ particleCount: 40, angle: 120, spread: 60, origin: { x: 0.65, y: 0.6 }, colors })
      }, 1100),
    ]
    return () => {
      timers.forEach(clearTimeout)
      fire.reset()
    }
  }, [])
  return (
    <div
      className="party fixed inset-0 z-50 grid cursor-pointer place-items-center bg-bg/40 backdrop-blur-md"
      role="status"
      aria-live="polite"
      onClick={() => useStore.setState({ pop: null })}
    >
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 size-full" />
      <div className="party-travel relative flex flex-col items-center gap-4">
        <DancingAvatar className="size-44" />
        <span className="rounded-full bg-card px-5 py-2.5 text-[18px] font-bold tracking-[-0.01em] shadow-soft">{t.text(line)}</span>
      </div>
    </div>
  )
}

/** The panel above today's timetable: start the Now task, the countdown, and what to do when time is up. */
export function FocusTimer() {
  const view = useTimerView()
  const tasks = useStore((s) => s.tasks)
  const startTimer = useStore((s) => s.startTimer)
  const stopTimer = useStore((s) => s.stopTimer)
  const pauseTimer = useStore((s) => s.pauseTimer)
  const resumeTimer = useStore((s) => s.resumeTimer)
  const timerEnd = useStore((s) => s.timerEnd)
  const setFocus = useStore((s) => s.setFocus)
  const thinking = useStore((s) => s.thinking)
  const mode = useStore((s) => s.settings.timerMode)
  const setTimerMode = useStore((s) => s.setTimerMode)
  const sound = useStore((s) => s.settings.timerSound ?? true)
  const setTimerSound = useStore((s) => s.setTimerSound)
  const t = useT()
  // The first Start asks how you want to focus (both kinds shown once); the start waits for the answer.
  const [choosing, setChoosing] = useState<(() => void) | null>(null)
  const begin = (start: () => void) => (mode ? clicked(start, playStart)() : setChoosing(() => start))
  const pick = (m: 'normal' | 'pomodoro') => {
    setTimerMode(m)
    toast(t('modeOn', { mode: m }))
    clicked(choosing ?? (() => {}), playStart)()
    setChoosing(null)
  }
  if (!view) return null
  const task = tasks.find((x) => x.id === view.block.taskId)
  if (!task) return null
  const name = taskTitle(task, t)
  const doneLabel = t('btnDone').replace(/^✓\s*/, '')

  if (view.kind === 'focus' || view.kind === 'pomoBreak') {
    const resting = view.kind === 'pomoBreak'
    const paused = view.pausedForMs !== undefined
    const done = 1 - view.leftMs / view.totalMs
    return (
      <Panel>
        {/* A phone: the countdown on top, its buttons on a row under it. */}
        <div className="flex flex-wrap items-center gap-3 max-sm:gap-2">
          <div className="min-w-0 flex-1 max-sm:basis-full">
            <div className="flex min-w-0 items-center gap-2">
              <Label>
                {paused
                  ? t('pausedFor', { d: countdown(view.pausedForMs!) })
                  : resting
                    ? t('shortBreak')
                    : view.round
                      ? t('focusRound', view.round)
                      : t('focus')}
              </Label>
              <ModeChip mode={mode ?? 'normal'} onChange={setTimerMode} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className={cn('text-[38px] leading-tight font-semibold tracking-[-0.02em] tabular-nums', paused && 'text-mut')} dir="ltr" role="timer">
                {countdown(view.leftMs)}
              </span>
              {/* On a break, when you're back matters more than the name (it's on the Now card just below). */}
              <span className="truncate text-[15px] font-medium text-mut">
                {resting ? (
                  <>
                    <span className="text-ink">{t('backAt', { time: clockAt(view.backAtMs) })}</span> · {name}
                  </>
                ) : (
                  name
                )}
              </span>
            </div>
          </div>
          {paused ? (
            <Button onClick={clicked(resumeTimer, playStart)} strong iconOnPhone icon={<Play className="size-3.5 fill-current" />}>{t('resumeTimer')}</Button>
          ) : (
            <Button onClick={clicked(pauseTimer, playPause)} iconOnPhone icon={<Pause className="size-3.5 fill-current" />}>{t('pauseTimer')}</Button>
          )}
          <Button onClick={clicked(() => timerEnd('done'))} strong={!paused} icon={<Check className="size-4" strokeWidth={2.5} />}>{doneLabel}</Button>
          <IconButton onClick={() => setTimerSound(!sound)} label={t(sound ? 'mute' : 'unmute')} pressed={!sound}>
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          </IconButton>
          <IconButton onClick={clicked(stopTimer)} label={t('stopTimer')}><Square className="size-3 fill-current" /></IconButton>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-blk">
          <div
            className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', resting || paused ? 'bg-mut/50' : 'bg-acc')}
            style={{ width: `${done * 100}%` }}
          />
        </div>
      </Panel>
    )
  }

  if (view.kind === 'ended') {
    const back = view.pausedMin
    return (
      <Panel ringing>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-0 flex-1 max-sm:basis-full">
            <Label>⏰ {t('timesUp')}</Label>
            <div className="truncate text-[17px] font-semibold" dir="auto">{name}</div>
          </div>
          <Button onClick={clicked(() => timerEnd('done'))} strong icon={<Check className="size-4" strokeWidth={2.5} />}>{doneLabel}</Button>
          <Button onClick={clicked(() => timerEnd('more', back || 15))} disabled={thinking} title={back ? t('yourPause') : undefined}>
            {back ? t('addBack', { min: back }) : t('plus15')}
          </Button>
          <Button onClick={clicked(() => timerEnd('tomorrow'))} disabled={thinking}>{t('toTomorrow')}</Button>
        </div>
      </Panel>
    )
  }

  // Not started on the timer: the Now task, or the next one (with the break's countdown if you're on one).
  // An activity (gym, groceries) gets no Start: just what it is and until when, and a quiet way to use the timer anyway.
  const rest = view.kind === 'next' ? view.rest : undefined
  const focusWork = task.focus !== false
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Label wrap>
            {view.kind === 'idle'
              ? `${t('now')} · ${t('untilTime', { time: clock(view.block.end) })}`
              : rest
                ? `${t('breakTime')} · ${t('nextUp')}: ${clock(view.block.start)}`
                : `${t('nextUp')} · ${clock(view.block.start)}`}
          </Label>
          <div className="flex items-baseline gap-3">
            {rest && (
              <span className="text-[38px] leading-tight font-semibold tracking-[-0.02em] tabular-nums" dir="ltr" role="timer">
                {countdown(rest.leftMs)}
              </span>
            )}
            <span className={cn('truncate', rest ? 'text-[15px] font-medium text-mut' : 'text-[17px] font-semibold')} dir="auto">{name}</span>
          </div>
        </div>
        {focusWork ? (
          <div className="sm:relative">
            <Button onClick={() => begin(() => startTimer(task.id))} strong={!rest} disabled={thinking} icon={<Play className="size-3.5 fill-current" />}>
              {t(view.kind === 'idle' ? 'startTimer' : 'startNow')}
            </Button>
            {choosing && <ChooseMode onPick={pick} onCancel={() => setChoosing(null)} />}
          </div>
        ) : (
          <div className="sm:relative">
            <button
              type="button"
              onClick={() =>
                begin(() => {
                  setFocus(task.id, true)
                  startTimer(task.id)
                })
              }
              className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] text-mut hover:bg-blk hover:text-ink"
            >
              {t('useTimer')}
            </button>
            {choosing && <ChooseMode onPick={pick} onCancel={() => setChoosing(null)} />}
          </div>
        )}
      </div>
    </Panel>
  )
}

const clockAt = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Panel({ children, ringing }: { children: ReactNode; ringing?: boolean }) {
  const t = useT()
  return (
    // (relative: on a phone the "how do you want to focus?" menu takes the panel's width.)
    <section aria-label={t('focusTimer')} className={cn('relative mb-5 rounded-2xl border bg-card px-4 py-4 shadow-soft sm:px-5', ringing && 'border-acc')}>
      {children}
    </section>
  )
}

/** `wrap`: on a phone the line may take two rows rather than lose its end ("Now · until 15:00" beside the Start button). */
function Label({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return <div className={cn('mb-0.5 min-w-0 truncate text-[11.5px] font-bold tracking-[0.07em] text-mut uppercase', wrap && 'max-sm:whitespace-normal')}>{children}</div>
}

function IconButton({ children, onClick, label, pressed }: { children: ReactNode; onClick: () => void; label: string; pressed?: boolean }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className="press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border text-mut hover:bg-blk hover:text-ink"
      >
        {children}
      </button>
    </Tip>
  )
}

/** `iconOnPhone`: just the icon on a phone (Pause, Resume: ⏸ ▶ say it), so the timer's buttons fit on one row. */
function Button({ children, onClick, strong, disabled, icon, title, iconOnPhone }: { children: ReactNode; onClick: () => void; strong?: boolean; disabled?: boolean; icon?: ReactNode; title?: string; iconOnPhone?: boolean }) {
  return (
    <Tip label={title}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'press inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-blk disabled:cursor-default disabled:opacity-40 max-sm:px-3.5',
          strong && 'border-acc bg-acc font-semibold text-accink hover:bg-acc',
          iconOnPhone && 'max-sm:size-9 max-sm:justify-center max-sm:px-0',
        )}
      >
        {icon}
        {iconOnPhone ? <span className="max-sm:sr-only">{children}</span> : children}
      </button>
    </Tip>
  )
}

/** Closes a small popup on a click outside it or Escape. */
function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [onClose])
  return ref
}

/** The first Start: both ways to focus, once. */
function ChooseMode({ onPick, onCancel }: { onPick: (m: 'normal' | 'pomodoro') => void; onCancel: () => void }) {
  const t = useT()
  const ref = useDismiss(onCancel)
  const option = (m: 'normal' | 'pomodoro', icon: string, title: string, sub: string) => (
    <button type="button" onClick={() => onPick(m)} className="press flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-blk">
      <span className="text-[18px] leading-6" aria-hidden>{icon}</span>
      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="block text-[13px] text-mut">{sub}</span>
      </span>
    </button>
  )
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('chooseFocus')}
      className="menu-in absolute end-0 top-[calc(100%+8px)] z-30 w-[290px] origin-top-right rounded-2xl border bg-card p-2 shadow-soft rtl:origin-top-left max-sm:inset-x-0 max-sm:w-auto"
    >
      <p className="m-0 px-3 pt-2 pb-1.5 text-[14px] font-semibold">{t('chooseFocus')}</p>
      {option('normal', '⏱', t('oneCountdown'), t('oneCountdownSub'))}
      {option('pomodoro', '🍅', t('timerPomodoro'), t('pomodoroSub'))}
      <p className="m-0 px-3 pt-1.5 pb-2 text-xs text-mut">{t('switchHint')}</p>
    </div>
  )
}

/** On the running timer: which kind it is, and a tiny menu to switch. */
function ModeChip({ mode, onChange }: { mode: 'normal' | 'pomodoro'; onChange: (m: 'normal' | 'pomodoro') => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(() => setOpen(false))
  const label = (m: 'normal' | 'pomodoro') => (m === 'normal' ? `⏱ ${t('countdown')}` : `🍅 ${t('timerPomodoro')}`)
  return (
    // (A phone: the menu hangs from the panel, under the chip's row, so a long label can't push it off the screen.)
    <div ref={ref} className="mb-0.5 shrink-0 sm:relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-mut hover:bg-blk hover:text-ink"
      >
        {label(mode)}
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="menu-in absolute start-0 top-[calc(100%+6px)] z-30 w-[230px] origin-top-left rounded-xl border bg-card p-1 shadow-soft rtl:origin-top-right max-sm:start-auto max-sm:end-4 max-sm:top-11">
          {(['normal', 'pomodoro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              onClick={() => {
                onChange(m)
                setOpen(false)
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[13px] hover:bg-blk"
            >
              <Check className={cn('size-3.5', mode !== m && 'invisible')} aria-hidden />
              <span>
                {label(m)}
                {m === 'pomodoro' && <span className="text-mut"> · 25/5</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
