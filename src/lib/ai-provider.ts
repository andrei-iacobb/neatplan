import OpenAI from 'openai'

export type AIProvider = 'openai' | 'ollama'

export class AIProviderUnavailableError extends Error {
  provider: AIProvider

  constructor(provider: AIProvider, message: string) {
    super(message)
    this.name = 'AIProviderUnavailableError'
    this.provider = provider
    Object.setPrototypeOf(this, AIProviderUnavailableError.prototype)
  }
}

// Module-level client cache, one instance per provider (mirrors the old
// lazy-singleton pattern from schedule-extraction.ts).
let openaiClient: OpenAI | null = null
let ollamaClient: OpenAI | null = null
let ollamaHealthCheck: Promise<void> | null = null
let ollamaHealthCheckedAt = 0
let ollamaLastError: AIProviderUnavailableError | null = null
let ollamaLastErrorAt = 0

const OLLAMA_HEALTH_TIMEOUT_MS = 5_000
const OLLAMA_HEALTH_CACHE_MS = 30_000
// Short negative cache: when Ollama is down, fail fast for this window instead of probing
// (and blocking up to OLLAMA_HEALTH_TIMEOUT_MS) on every single request, while still
// recovering quickly once it comes back.
const OLLAMA_HEALTH_NEG_CACHE_MS = 10_000

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

function getOllamaServerUrl(): string {
  const configured = process.env.OLLAMA_BASE_URL
  if (!configured) {
    return 'http://localhost:11434'
  }

  try {
    const url = new URL(configured)
    if (url.pathname === '/v1' || url.pathname.endsWith('/v1/')) {
      url.pathname = url.pathname.replace(/\/v1\/?$/, '') || '/'
    }
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return configured.replace(/\/v1\/?$/, '').replace(/\/$/, '')
  }
}

function getOllamaTagsUrl(): string {
  return `${getOllamaServerUrl()}/api/tags`
}

export async function ensureAIProviderReady(provider: AIProvider = resolveAIProvider()): Promise<void> {
  if (provider !== 'ollama') {
    return
  }

  // Positive cache: a recent successful check means the provider is ready.
  if (Date.now() - ollamaHealthCheckedAt < OLLAMA_HEALTH_CACHE_MS) {
    return
  }

  // Negative cache: a recent failure fails fast without re-probing on every request.
  if (ollamaLastError && Date.now() - ollamaLastErrorAt < OLLAMA_HEALTH_NEG_CACHE_MS) {
    throw ollamaLastError
  }

  if (!ollamaHealthCheck) {
    const tagsUrl = getOllamaTagsUrl()
    ollamaHealthCheck = fetch(tagsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(OLLAMA_HEALTH_TIMEOUT_MS),
    })
      .then((response) => {
        if (!response.ok) {
          throw new AIProviderUnavailableError(
            'ollama',
            `Ollama is unavailable at ${tagsUrl} (HTTP ${response.status}). Start Ollama and try again.`
          )
        }
        ollamaHealthCheckedAt = Date.now()
        ollamaLastError = null
      })
      .catch((error) => {
        const err = error instanceof AIProviderUnavailableError
          ? error
          : new AIProviderUnavailableError(
              'ollama',
              `Ollama is unavailable at ${tagsUrl}. Start Ollama and try again.`
            )
        ollamaLastError = err
        ollamaLastErrorAt = Date.now()
        throw err
      })
      .finally(() => {
        ollamaHealthCheck = null
      })
  }

  return ollamaHealthCheck
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
