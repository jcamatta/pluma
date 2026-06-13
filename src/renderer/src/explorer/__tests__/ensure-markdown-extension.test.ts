import { describe, expect, it } from 'vitest'
import { ensureMarkdownExtension } from '../ensure-markdown-extension'

describe('ensureMarkdownExtension', () => {
  it('appends .md to a bare name', () => {
    expect(ensureMarkdownExtension('draft')).toBe('draft.md')
  })

  it('leaves a name that already ends in .md unchanged', () => {
    expect(ensureMarkdownExtension('notes.md')).toBe('notes.md')
  })

  it('treats the extension case-insensitively, never doubling it', () => {
    expect(ensureMarkdownExtension('Notes.MD')).toBe('Notes.MD')
  })

  it('appends .md to a name whose dot is not a .md extension', () => {
    expect(ensureMarkdownExtension('my.notes')).toBe('my.notes.md')
  })
})
