// Pure path/entry helpers: path joining, parenting, and entry sorting. No IPC, no React.

import { describe, expect, it } from 'vitest'
import { joinPath, parentPath, sortEntries } from '../explorer-tree'

describe('joinPath', () => {
  it('joins a posix path with a forward slash', () => {
    expect(joinPath('/home/user', 'notes.md')).toBe('/home/user/notes.md')
  })

  it('joins a windows path with a backslash', () => {
    expect(joinPath('C:\\Users\\me', 'notes.md')).toBe('C:\\Users\\me\\notes.md')
  })

  it('does not double the separator when the parent ends with one', () => {
    expect(joinPath('/home/', 'a')).toBe('/home/a')
    expect(joinPath('C:\\x\\', 'a')).toBe('C:\\x\\a')
  })
})

describe('parentPath', () => {
  it('returns the directory above a posix path', () => {
    expect(parentPath('/home/user/notes.md')).toBe('/home/user')
  })

  it('returns the directory above a windows path', () => {
    expect(parentPath('C:\\Users\\me\\notes.md')).toBe('C:\\Users\\me')
  })

  it('returns null when there is nothing above', () => {
    expect(parentPath('notes.md')).toBeNull()
  })
})

describe('sortEntries', () => {
  it('puts directories first, then files, each alphabetical and case-insensitive', () => {
    const sorted = sortEntries([
      { name: 'beta.md', type: 'file' },
      { name: 'Zed', type: 'directory' },
      { name: 'alpha.md', type: 'file' },
      { name: 'art', type: 'directory' }
    ])
    expect(sorted.map((e) => e.name)).toEqual(['art', 'Zed', 'alpha.md', 'beta.md'])
  })
})
