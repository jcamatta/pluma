// listOpenFiles maps the open paths to files the agent can address: each carries its path, the
// `.md`-stripped display name, and an `active` flag for the file the user is currently in.

import { describe, expect, it } from 'vitest'
import { listOpenFiles } from '../tool-list-open-files'

describe('listOpenFiles', () => {
  it('maps open paths to files and flags the active one', () => {
    const result = listOpenFiles({
      openPaths: ['/book/Act I.md', '/book/notes.md'],
      activePath: '/book/notes.md'
    })

    expect(result).toEqual({
      ok: true,
      output: {
        type: 'json',
        value: {
          files: [
            { path: '/book/Act I.md', name: 'Act I', active: false },
            { path: '/book/notes.md', name: 'notes', active: true }
          ]
        }
      }
    })
  })

  it('returns an empty list when nothing is open', () => {
    expect(listOpenFiles({ openPaths: [], activePath: null })).toEqual({
      ok: true,
      output: { type: 'json', value: { files: [] } }
    })
  })
})
