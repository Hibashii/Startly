import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { AssistantResponse, type AssistantContext } from '../shared/schema.js'
import { SYSTEM_PROMPT, formatInput } from './prompt.js'

let client: OpenAI | null = null
function getClient() {
  client ??= new OpenAI({ timeout: 50_000, maxRetries: 0 }) // under the browser's 55 s limit
  return client
}

export const model = () => process.env.OPENAI_MODEL || 'gpt-6-luna'
// How long the model thinks before answering. Designing a whole day needs it ("medium": 13–27 s, reliable);
// a small change to a day that exists ("I need more time") doesn't ("low": 5–10 s).
type Effort = 'low' | 'medium' | 'high'
const effortFor = (context: AssistantContext): Effort => {
  const set = process.env.OPENAI_REASONING_EFFORT as Effort | undefined
  if (set) return set
  return context.tasks.some((t) => t.status === 'todo' && t.date === context.today) ? 'low' : 'medium'
}

export async function callAssistant(message: string, context: AssistantContext): Promise<AssistantResponse> {
  const response = await getClient().responses.parse({
    model: model(),
    instructions: SYSTEM_PROMPT,
    input: [{ role: 'user', content: formatInput(message, context) }],
    text: { format: zodTextFormat(AssistantResponse, 'startly') },
    reasoning: { effort: effortFor(context) },
  })
  if (!response.output_parsed) throw new Error('empty_output')
  return response.output_parsed
}
