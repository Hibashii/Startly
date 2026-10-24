import { useEffect, useRef, useState } from 'react'
import { transcribe } from './api'

export type VoiceState = 'idle' | 'recording' | 'transcribing'
export type VoiceError = 'no_mic' | 'rate_limited' | 'unavailable' | 'empty'
/** What happens to the words: into the text box to check first, or straight to Startly. */
export type VoiceEnd = 'insert' | 'send'

const MAX_MS = 2 * 60_000 // well under the server's 4 MB
const MIN_MS = 400 // a tap, not speech: nothing to send

export const voiceSupported = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Chrome and Firefox record webm, Safari mp4. The transcriber reads both. */
const mimeType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))

type Session = { rec: MediaRecorder; stream: MediaStream; audio: AudioContext | null; end: VoiceEnd | 'cancel' }

/**
 * Tap the mic, talk, then: ✕ throws it away, ■ puts the words in the box, ↑ sends them.
 * `level()` is how loud it is right now (0–1), for the waveform. The mic is released as soon as recording stops.
 */
export function useVoice({ onText, onError }: { onText: (text: string, end: VoiceEnd) => void; onError: (e: VoiceError) => void }) {
  const [state, setState] = useState<VoiceState>('idle')
  const [ending, setEnding] = useState<VoiceEnd | null>(null)
  const session = useRef<Session | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const unmounted = useRef(false)
  const handlers = useRef({ onText, onError })
  handlers.current = { onText, onError }

  // Closing the chat mid-recording: stop the mic, send nothing.
  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      stop('cancel')
    }
  }, [])

  async function start() {
    if (state !== 'idle') return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      handlers.current.onError('no_mic')
      return
    }
    // Only for the waveform: if Web Audio isn't there, recording still works (flat line).
    let audio: AudioContext | null = null
    try {
      audio = new AudioContext()
      const node = audio.createAnalyser()
      node.fftSize = 1024
      audio.createMediaStreamSource(stream).connect(node)
      analyser.current = node
    } catch {
      audio = null
    }
    const rec = new MediaRecorder(stream, { mimeType: mimeType() })
    const chunks: Blob[] = []
    const startedAt = Date.now()
    const s: Session = { rec, stream, audio, end: 'insert' }
    const limit = setTimeout(() => stop('insert'), MAX_MS)
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = async () => {
      clearTimeout(limit)
      if (s.end === 'cancel' || unmounted.current || Date.now() - startedAt < MIN_MS) {
        setState('idle')
        setEnding(null)
        return
      }
      setState('transcribing')
      const result = await transcribe(new Blob(chunks, { type: rec.mimeType }))
      if (unmounted.current) return
      setState('idle')
      setEnding(null)
      if (!result.ok) handlers.current.onError(result.error)
      else if (!result.text) handlers.current.onError('empty')
      else handlers.current.onText(result.text, s.end as VoiceEnd)
    }
    session.current = s
    rec.start()
    setState('recording')
  }

  function stop(end: VoiceEnd | 'cancel') {
    const s = session.current
    if (!s) return
    session.current = null
    analyser.current = null
    s.end = end
    if (end !== 'cancel') setEnding(end)
    if (s.rec.state !== 'inactive') s.rec.stop() // first: the last chunk still arrives
    s.stream.getTracks().forEach((t) => t.stop())
    s.audio?.close().catch(() => {})
  }

  const samples = useRef<Float32Array<ArrayBuffer> | null>(null)
  function level() {
    const node = analyser.current
    if (!node) return 0
    if (samples.current?.length !== node.fftSize) samples.current = new Float32Array(node.fftSize)
    node.getFloatTimeDomainData(samples.current)
    let sum = 0
    for (const x of samples.current) sum += x * x
    return Math.min(1, Math.sqrt(sum / samples.current.length) * 5) // speech RMS is ~0.02–0.2
  }

  return {
    state,
    /** Which button ended the recording (its spinner shows while transcribing). */
    ending,
    start,
    cancel: () => stop('cancel'),
    insert: () => stop('insert'),
    send: () => stop('send'),
    level,
  }
}
