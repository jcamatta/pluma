import { describe, expect, it } from 'vitest'
import { ensureMarkdownExtension } from '../ensure-markdown-extension'

describe('ensureMarkdownExtension', () => {
  it('appends .md to a bare path', () => {
    expect(ensureMarkdownExtension('/notes/draft')).toBe('/notes/draft.md')
  })

  it('leaves a path that already ends in .md unchanged', () => {
    expect(ensureMarkdownExtension('/notes/draft.md')).toBe('/notes/draft.md')
  })

  it('treats the extension case-insensitively, never doubling it', () => {
    expect(ensureMarkdownExtension('/notes/DRAFT.MD')).toBe('/notes/DRAFT.MD')
  })

  it('appends .md when the dot is not a .md extension', () => {
    expect(ensureMarkdownExtension('/notes/my.notes')).toBe('/notes/my.notes.md')
  })

  it('trims surrounding whitespace before appending', () => {
    expect(ensureMarkdownExtension('  /notes/draft  ')).toBe('/notes/draft.md')
  })

  it('leaves an empty or whitespace-only path empty for validation to reject', () => {
    expect(ensureMarkdownExtension('   ')).toBe('')
  })
})
