// Tests for the context-meter display calculations: ratio clamping, percent rounding, and the compact
// token label.

import { describe, expect, it } from 'vitest'
import { contextPercent, contextRatio, formatTokenCount } from '../context-meter-logic'

describe('contextRatio', () => {
  it('is the used/window fraction, clamped to 0..1', () => {
    expect(contextRatio(60_000, 1_000_000)).toBeCloseTo(0.06)
    expect(contextRatio(2_000_000, 1_000_000)).toBe(1)
    expect(contextRatio(-5, 1_000_000)).toBe(0)
  })

  it('is zero for a non-positive window', () => {
    expect(contextRatio(100, 0)).toBe(0)
  })
})

describe('contextPercent', () => {
  it('rounds the ratio to a whole percent', () => {
    expect(contextPercent(0.06)).toBe(6)
    expect(contextPercent(0.125)).toBe(13)
  })
})

describe('formatTokenCount', () => {
  it('formats thousands and millions with one decimal, smaller counts as-is', () => {
    expect(formatTokenCount(60_300)).toBe('60.3k')
    expect(formatTokenCount(1_000_000)).toBe('1.0M')
    expect(formatTokenCount(950)).toBe('950')
  })
})
