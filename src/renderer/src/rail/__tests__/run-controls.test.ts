// run-controls: the composer offers exactly the two models and the three standard effort levels, and the
// defaults are Opus 4.8 / medium. Guards the curated UI scope so xhigh/max never leak into the lists.

import { describe, expect, it } from 'vitest'
import { DEFAULT_EFFORT, DEFAULT_MODEL, EFFORT_OPTIONS, MODEL_OPTIONS } from '../run-controls'

describe('run-controls', () => {
  it('offers exactly the two in-scope models', () => {
    expect(MODEL_OPTIONS.map((option) => option.value)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6'
    ])
  })

  it('offers exactly the three standard effort levels', () => {
    expect(EFFORT_OPTIONS.map((option) => option.value)).toEqual(['low', 'medium', 'high'])
  })

  it('defaults to opus 4.8 and medium effort', () => {
    expect(DEFAULT_MODEL).toBe('claude-opus-4-8')
    expect(DEFAULT_EFFORT).toBe('medium')
  })

  it('pairs every option with a label key', () => {
    for (const option of [...MODEL_OPTIONS, ...EFFORT_OPTIONS]) {
      expect(option.labelKey.length).toBeGreaterThan(0)
    }
  })
})
