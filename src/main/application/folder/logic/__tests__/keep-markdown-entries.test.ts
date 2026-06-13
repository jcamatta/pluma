import { describe, expect, it } from 'vitest'
import type { FolderEntry } from '../../data/entry'
import { keepMarkdownEntries } from '../keep-markdown-entries'

describe('keepMarkdownEntries', () => {
  it('keeps directories and Markdown files, dropping any other file', () => {
    const entries: ReadonlyArray<FolderEntry> = [
      { name: 'ideas', type: 'directory' },
      { name: 'todo.md', type: 'file' },
      { name: 'notes.txt', type: 'file' },
      { name: 'image.png', type: 'file' },
      { name: 'README', type: 'file' }
    ]

    expect(keepMarkdownEntries(entries)).toStrictEqual([
      { name: 'ideas', type: 'directory' },
      { name: 'todo.md', type: 'file' }
    ])
  })

  it('matches the .md extension case-insensitively', () => {
    const entries: ReadonlyArray<FolderEntry> = [
      { name: 'CHANGELOG.MD', type: 'file' },
      { name: 'draft.Md', type: 'file' }
    ]

    expect(keepMarkdownEntries(entries)).toStrictEqual(entries)
  })

  it('does not treat a name merely containing "md" as Markdown', () => {
    const entries: ReadonlyArray<FolderEntry> = [
      { name: 'md', type: 'file' },
      { name: 'readme.markdown', type: 'file' }
    ]

    expect(keepMarkdownEntries(entries)).toStrictEqual([])
  })

  it('returns an empty list unchanged', () => {
    expect(keepMarkdownEntries([])).toStrictEqual([])
  })
})
