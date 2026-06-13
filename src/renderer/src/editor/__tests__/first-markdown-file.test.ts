import { describe, expect, it } from 'vitest'
import { firstMarkdownFile } from '../first-markdown-file'
import type { FolderEntry } from '../../../../shared/ipc/ipc-contract/folder'

function file(name: string): FolderEntry {
  return { name, type: 'file' }
}

function dir(name: string): FolderEntry {
  return { name, type: 'directory' }
}

describe('firstMarkdownFile', () => {
  it('picks the alphabetically first markdown file', () => {
    expect(firstMarkdownFile([file('beta.md'), file('alpha.md')])).toBe('alpha.md')
  })

  it('ignores directories, even ones named like markdown', () => {
    expect(firstMarkdownFile([dir('alpha.md'), file('beta.md')])).toBe('beta.md')
  })

  it('ignores non-markdown files', () => {
    expect(firstMarkdownFile([file('notes.txt'), file('image.png'), file('draft.md')])).toBe(
      'draft.md'
    )
  })

  it('matches the .md extension case-insensitively', () => {
    expect(firstMarkdownFile([file('README.MD')])).toBe('README.MD')
  })

  it('returns null when there is no markdown file', () => {
    expect(firstMarkdownFile([file('notes.txt'), dir('chapters')])).toBeNull()
  })

  it('returns null for an empty listing', () => {
    expect(firstMarkdownFile([])).toBeNull()
  })
})
