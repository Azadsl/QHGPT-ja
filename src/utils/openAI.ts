import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import type { ChatMessage } from '@/types'

export const generatePayload = (apiKey: string, temperature :number, messages: ChatMessage[]): RequestInit => ({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  method: 'POST',
  body: JSON.stringify({
    model: 'deepseek-ai/DeepSeek-V3',
    messages,
    temperature: temperature,
    presence_penalty:1,
    frequency_penalty:1,
    stream: true,
  }),
})

export const parseOpenAIStream = (rawResponse: Response) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const streamParser = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data
          if (data === '[DONE]') {
            controller.close()
            return
          }
          try {
            const json = JSON.parse(data)
            const text = json.choices[0].delta?.content || ''
            const queue = encoder.encode(text)
            controller.enqueue(queue)
          } catch (e) {
            controller.error(e)
          }
        }
      }

      const parser = createParser(streamParser)
      for await (const chunk of rawResponse.body as any) {
        parser.feed(decoder.decode(chunk))
      }
    },
  })

  return stream
}
