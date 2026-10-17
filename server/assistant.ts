import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { AssistantResponse, type AssistantContext } from '../shared/schema'
import { SYSTEM_PROMPT, formatInput } from './prompt'

let client: OpenAI | null = null
function getClient() {
  client ??= new OpenAI({ timeout: 25_000, maxRetries: 0 }) // under the browser's 30 s limit
  return client
}

export const model = () => process.env.OPENAI_MODEL || 'gpt-6-luna'

export async function callAssistant(message: string, context: AssistantContext): Promise<AssistantResponse> {
  const response = await getClient().responses.parse({
    model: model(),
    instructions: SYSTEM_PROMPT,
    input: [{ role: 'user', content: formatInput(message, context) }],
    text: { format: zodTextFormat(AssistantResponse, 'startly') },
  })
  if (!response.output_parsed) throw new Error('empty_output')
  return response.output_parsed
}
