import { toFile } from 'openai'
import { getClient } from './assistant.js'

export const transcribeModel = () => process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'

/**
 * Spoken words → text, as said: "uh" included. Hesitations differ in every language, so the planner sorts them out
 * (see the voice rule in prompt.ts). No language hint either: people mix languages, and the model finds it on its own.
 */
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
  const result = await getClient().audio.transcriptions.create({
    model: transcribeModel(),
    file: await toFile(audio, `speech.${ext}`, { type: mimeType }),
  })
  return result.text.trim()
}
