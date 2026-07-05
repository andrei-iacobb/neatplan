import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveAIProvider } from '@/lib/ai-provider'

describe('resolveAIProvider', () => {
  const savedScheduleProvider = process.env.SCHEDULE_AI_PROVIDER
  const savedOpenAiKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    delete process.env.SCHEDULE_AI_PROVIDER
    delete process.env.OPENAI_API_KEY
  })

  afterEach(() => {
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
