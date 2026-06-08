// Pure file-name derivation: basename of the open path with a trailing `.md` stripped, falling back when
// no file is open or the path yields no usable name.

import { describe, expect, it } from 'vitest'
import { editorFileName } from '../editor-file-name-logic'

describe('editorFileName', () => {
  it('returns the fallback when no file is open', () => {
    expect(editorFileName(null, 'Untitled')).toBe('Untitled')
  })

  it('strips the directory and the .md extension from a posix path', () => {
    expect(editorFileName('/home/me/docs/Act I.md', 'Untitled')).toBe('Act I')
  })

  it('strips the directory and the .md extension from a windows path', () => {
    expect(editorFileName('C:\\Users\\me\\docs\\Chapter 12.md', 'Untitled')).toBe('Chapter 12')
  })

  it('keeps a non-md extension intact', () => {
    expect(editorFileName('/notes/todo.txt', 'Untitled')).toBe('todo.txt')
  })

  it('returns the fallback when the basename is empty after stripping', () => {
    expect(editorFileName('/notes/.md', 'Untitled')).toBe('Untitled')
  })
})
