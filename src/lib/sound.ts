// The timer's sounds, made with the Web Audio API (no sound files to load).
let ctx: AudioContext | null = null

/** Browsers only allow sound after a click: every timer button calls this. */
export function unlockSound() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // No audio here: the timer still works, silently.
  }
}

/** Play notes: [frequency, start (s), length (s)], soft attack and a natural fade. */
function play(notes: [number, number, number][], volume = 0.22, type: OscillatorType = 'sine') {
  unlockSound()
  if (!ctx) return
  const t0 = ctx.currentTime + 0.03
  for (const [freq, at, len] of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = t0 + at
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + len + 0.05)
  }
}

/** Start / Resume: a quick rising "ti-ding". */
export const playStart = () => play([[660, 0, 0.12], [990, 0.07, 0.22]], 0.18)

/** Pause: a soft low "dum". */
export const playPause = () => play([[330, 0, 0.18], [220, 0.06, 0.3]], 0.2, 'triangle')

/** A focus round done: a happy little run up. */
export const playRoundDone = () => play([[523, 0, 0.25], [659, 0.1, 0.25], [784, 0.2, 0.25], [1047, 0.3, 0.5]], 0.2)

/** Time's up, or a break is over: a three-note bell, twice. */
export const ring = () =>
  play([0, 0.9].flatMap((rep) => [880, 1174.7, 1568].map((f, i): [number, number, number] => [f, rep + i * 0.16, 0.7])), 0.25)
