import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveAIProvider } from '@/lib/ai-provider'

describe('resolveAIProvider', () => {
  const savedScheduleProvider = process.env.SCHEDULE_AI_PROVIDER
  const savedOpenAiKey = process.env.OPENAI_API_KEY
  const savedOllamaBaseUrl = process.env.OLLAMA_BASE_URL

  beforeEach(() => {
    delete process.env.SCHEDULE_AI_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OLLAMA_BASE_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (savedScheduleProvider === undefined) {
      delete process.env.SCHEDULE_AI_PROVIDER
    } else {
      process.env.SCHEDULE_AI_PROVIDER = savedScheduleProvider
    }
    if (savedOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = savedOpenAiKey
    }
    if (savedOllamaBaseUrl === undefined) {
      delete process.env.OLLAMA_BASE_URL
    } else {
      process.env.OLLAMA_BASE_URL = savedOllamaBaseUrl
    }
  })

  it('uses explicit ollama even when an OpenAI key is present', () => {
    process.env.SCHEDULE_AI_PROVIDER = 'ollama'
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(resolveAIProvider()).toBe('ollama')
  })

  it('uses explicit openai even without an OpenAI key', () => {
    process.env.SCHEDULE_AI_PROVIDER = 'openai'
    expect(resolveAIProvider()).toBe('openai')
  })

  it('defaults to openai when unset and OPENAI_API_KEY is present', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(resolveAIProvider()).toBe('openai')
  })

  it('defaults to ollama when unset and no OPENAI_API_KEY', () => {
    expect(resolveAIProvider()).toBe('ollama')
  })

  it('falls back to the default rule on a garbage value', () => {
    process.env.SCHEDULE_AI_PROVIDER = 'gpt-sixty-nine'
    expect(resolveAIProvider()).toBe('ollama')

    process.env.OPENAI_API_KEY = 'sk-test'
    expect(resolveAIProvider()).toBe('openai')
  })

  it('treats an empty OPENAI_API_KEY as unset', () => {
    process.env.OPENAI_API_KEY = ''
    expect(resolveAIProvider()).toBe('ollama')
  })
})

describe('ensureAIProviderReady', () => {
  const savedOllamaBaseUrl = process.env.OLLAMA_BASE_URL

  beforeEach(() => {
    vi.resetModules()
    delete process.env.OLLAMA_BASE_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (savedOllamaBaseUrl === undefined) {
      delete process.env.OLLAMA_BASE_URL
    } else {
      process.env.OLLAMA_BASE_URL = savedOllamaBaseUrl
    }
  })

  it('does not fetch when the provider is openai', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { ensureAIProviderReady } = await import('@/lib/ai-provider')

    await ensureAIProviderReady('openai')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks Ollama tags with a fast timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const { ensureAIProviderReady } = await import('@/lib/ai-provider')

    await ensureAIProviderReady('ollama')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    )
  })

  it('normalizes an Ollama OpenAI-compatible base URL for the tags check', async () => {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const { ensureAIProviderReady } = await import('@/lib/ai-provider')

    await ensureAIProviderReady('ollama')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.any(Object)
    )
  })

  it('throws a typed error when Ollama is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)
    const { AIProviderUnavailableError, ensureAIProviderReady } = await import('@/lib/ai-provider')

    await expect(ensureAIProviderReady('ollama')).rejects.toBeInstanceOf(AIProviderUnavailableError)
    await expect(ensureAIProviderReady('ollama')).rejects.toMatchObject({
      provider: 'ollama',
      message: 'Ollama is unavailable at http://localhost:11434/api/tags. Start Ollama and try again.',
    })
  })
})
