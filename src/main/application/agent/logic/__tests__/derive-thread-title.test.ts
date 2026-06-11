// Tests for deriveThreadTitle: the pure calculation that turns a thread's first user message into a
// single-line title — whitespace collapsed and trimmed, long text truncated with an ellipsis, and an
// empty/whitespace-only message reduced to an empty string (the renderer supplies the fallback).

import { describe, expect, it } from 'vitest'
import { deriveThreadTitle } from '../derive-thread-title'

describe('deriveThreadTitle', () => {
  it('collapses whitespace and trims', () => {
    expect(deriveThreadTitle('  hello   world \n ')).toBe('hello world')
  })

  it('returns an empty string for a blank message', () => {
    expect(deriveThreadTitle('   \n\t ')).toBe('')
  })

  it('truncates long messages with an ellipsis', () => {
    const long = 'a'.repeat(80)
    const title = deriveThreadTitle(long)
    expect(title.endsWith('…')).toBe(true)
    expect(title.length).toBeLessThanOrEqual(61)
  })

  it('keeps a short message intact', () => {
    expect(deriveThreadTitle('Write a poem')).toBe('Write a poem')
  })
})
