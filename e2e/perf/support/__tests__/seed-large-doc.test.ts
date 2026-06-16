import { describe, expect, it } from 'vitest'
import { largeMarkdown } from '../seed-large-doc'

describe('largeMarkdown', () => {
  it('starts with the stable heading', () => {
    expect(largeMarkdown(160)).toMatch(/^# Large manuscript\n\n/)
  })

  it('produces roughly the requested number of words', () => {
    const words = largeMarkdown(800).split(/\s+/).filter(Boolean)
    expect(words.length).toBeGreaterThanOrEqual(800)
    expect(words.length).toBeLessThan(900)
  })

  it('is deterministic for a given word count', () => {
    expect(largeMarkdown(400)).toBe(largeMarkdown(400))
  })

  it('splits the body into paragraphs', () => {
    expect(largeMarkdown(160).split('\n\n').length).toBeGreaterThanOrEqual(3)
  })
})
