// artifactKey makes a panel-wide identity from (path, id): per-editor ids collide across files, so the
// same id in two files must yield two distinct keys, while the same (path, id) yields a stable one.

import { describe, expect, it } from 'vitest'
import { artifactKey } from '../artifact-key'

describe('artifactKey', () => {
  it('is stable for the same path and id', () => {
    expect(artifactKey({ path: '/a.md', id: 'a_1' })).toBe(
      artifactKey({ path: '/a.md', id: 'a_1' })
    )
  })

  it('distinguishes the same id in different files', () => {
    expect(artifactKey({ path: '/a.md', id: 'a_1' })).not.toBe(
      artifactKey({ path: '/b.md', id: 'a_1' })
    )
  })
})
