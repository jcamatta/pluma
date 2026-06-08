// buildTree: pure assembly of the nested view tree from the open-set and a listing lookup. Folders are
// open per the set; an open folder's children come from the lookup (undefined while loading, [] when
// empty); a closed folder carries children: undefined.

import { describe, expect, it } from 'vitest'
import { buildTree } from '../explorer-tree-build'
import type { ListingLookup } from '../explorer-tree-build'
import type { FolderEntry } from '../../../../shared/ipc/ipc-contract/folder'

const lookupFrom =
  (listings: Readonly<Record<string, readonly FolderEntry[]>>): ListingLookup =>
  (path) =>
    listings[path]

describe('buildTree', () => {
  it('returns an empty tree when the root listing is not loaded', () => {
    expect(buildTree({ root: '/root', openPaths: new Set(), lookup: () => undefined })).toEqual([])
  })

  it('builds the root, directories first then files, folders closed and unloaded', () => {
    const tree = buildTree({
      root: '/root',
      openPaths: new Set(),
      lookup: lookupFrom({
        '/root': [
          { name: 'a.md', type: 'file' },
          { name: 'dir', type: 'directory' }
        ]
      })
    })
    expect(tree).toEqual([
      { path: '/root/dir', name: 'dir', type: 'directory', open: false, children: undefined },
      { path: '/root/a.md', name: 'a.md', type: 'file' }
    ])
  })

  it('expands an open folder with its loaded children', () => {
    const tree = buildTree({
      root: '/root',
      openPaths: new Set(['/root/dir']),
      lookup: lookupFrom({
        '/root': [{ name: 'dir', type: 'directory' }],
        '/root/dir': [{ name: 'child.md', type: 'file' }]
      })
    })
    expect(tree[0]).toMatchObject({
      open: true,
      children: [{ path: '/root/dir/child.md', name: 'child.md', type: 'file' }]
    })
  })

  it('marks an open folder open with children undefined while its listing is loading', () => {
    const tree = buildTree({
      root: '/root',
      openPaths: new Set(['/root/dir']),
      lookup: lookupFrom({ '/root': [{ name: 'dir', type: 'directory' }] })
    })
    expect(tree[0]).toMatchObject({ open: true, children: undefined })
  })

  it('nests open folders recursively', () => {
    const tree = buildTree({
      root: '/root',
      openPaths: new Set(['/root/a', '/root/a/b']),
      lookup: lookupFrom({
        '/root': [{ name: 'a', type: 'directory' }],
        '/root/a': [{ name: 'b', type: 'directory' }],
        '/root/a/b': [{ name: 'deep.md', type: 'file' }]
      })
    })
    expect(tree[0].children?.[0]).toMatchObject({
      path: '/root/a/b',
      open: true,
      children: [{ path: '/root/a/b/deep.md', name: 'deep.md', type: 'file' }]
    })
  })
})
