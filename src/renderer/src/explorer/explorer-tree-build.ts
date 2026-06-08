// Pure assembly of the explorer's nested tree from React Query data. Given the set of open folder paths
// and a lookup from a folder path to its listed entries (undefined = not loaded yet), it builds the
// readonly TreeNodeModel[] the view renders. No IPC, no React: a calculation, unit-tested in isolation.
//
// A folder node is `open` when its path is in openPaths; an open folder's `children` are built
// recursively from the lookup (undefined while its listing is still loading, [] when loaded empty).
// Closed folders carry children: undefined so the view shows them collapsed without their contents.

import type { FolderEntry } from '../../../shared/ipc/ipc-contract/folder'
import type { TreeNodeModel } from './explorer-view-types'
import { joinPath, sortEntries } from './explorer-tree'

type ListingLookup = (path: string) => readonly FolderEntry[] | undefined

function buildNodes(args: {
  readonly parent: string
  readonly entries: readonly FolderEntry[]
  readonly openPaths: ReadonlySet<string>
  readonly lookup: ListingLookup
}): readonly TreeNodeModel[] {
  return sortEntries(args.entries).map((entry): TreeNodeModel => {
    const path = joinPath(args.parent, entry.name)
    if (entry.type === 'file') return { path, name: entry.name, type: 'file' }
    const open = args.openPaths.has(path)
    const childEntries = open ? args.lookup(path) : undefined
    return {
      path,
      name: entry.name,
      type: 'directory',
      open,
      children:
        childEntries &&
        buildNodes({
          parent: path,
          entries: childEntries,
          openPaths: args.openPaths,
          lookup: args.lookup
        })
    }
  })
}

function buildTree(args: {
  readonly root: string
  readonly openPaths: ReadonlySet<string>
  readonly lookup: ListingLookup
}): readonly TreeNodeModel[] {
  const rootEntries = args.lookup(args.root)
  if (!rootEntries) return []
  return buildNodes({
    parent: args.root,
    entries: rootEntries,
    openPaths: args.openPaths,
    lookup: args.lookup
  })
}

export { buildTree }
export type { ListingLookup }
