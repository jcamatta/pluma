// Tests for contextWindowForModel: the 1M window for the two offered models and the 200k fallback for
// anything else.

import { describe, expect, it } from 'vitest'
import { DEFAULT_WINDOW, contextWindowForModel } from '../context-window'

describe('contextWindowForModel', () => {
  it('reports 1M for the offered models', () => {
    expect(contextWindowForModel('claude-opus-4-8')).toBe(1_000_000)
    expect(contextWindowForModel('claude-sonnet-4-6')).toBe(1_000_000)
  })

  it('falls back to the 200k baseline for an unknown model', () => {
    expect(contextWindowForModel('some-other-model')).toBe(DEFAULT_WINDOW)
    expect(DEFAULT_WINDOW).toBe(200_000)
  })
})
