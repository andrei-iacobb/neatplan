import OpenAI from 'openai'

export type AIProvider = 'openai' | 'ollama'

// Module-level client cache, one instance per provider (mirrors the old
// lazy-singleton pattern from schedule-extraction.ts).
let openaiClient: OpenAI | null = null
let ollamaClient: OpenAI | null = null

export function resolveAIProvider(): AIProvider {
  const explicit = process.env.SCHEDULE_AI_PROVIDER

  if (explicit === 'openai' || explicit === 'ollama') {
    return explicit
  }

  // Default: 'openai' if key is set (non-empty), otherwise 'ollama'
  if (process.env.OPENAI_API_KEY) {
    return 'openai'
  }

  return 'ollama'
}

export function getAIClient(): {
  client: OpenAI
  model: string
  provider: AIProvider
  supportsVision: boolean
} {
  const provider = resolveAIProvider()

  if (provider === 'openai') {
    if (!openaiClient) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }
      openaiClient = new OpenAI({
        apiKey,
        timeout: 60_000,
        maxRetries: 2,
      })
    }

    return {
      client: openaiClient,
      model: 'gpt-4o',
      provider,
      supportsVision: true,
    }
  }

  if (!ollamaClient) {
    ollamaClient = new OpenAI({
      apiKey: 'ollama',
      baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      timeout: 120_000,
      maxRetries: 1,
    })
  }

  return {
    client: ollamaClient,
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    provider,
    supportsVision: false,
  }
}
