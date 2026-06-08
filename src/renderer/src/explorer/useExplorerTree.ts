// Orchestrates the explorer's lazily-loaded tree on top of React Query. Open folders are local UI state
// (a Set of paths); their listings come from useFolderListings (one ['folder', path] query per open
// path). The tree the view renders is a pure build (buildTree) from the open-set and those listings.
// The write side (create/delete + the OS watcher) lives in useExplorerCommands, kept apart per CQS;
// this hook owns the read/tree side and the draft/open UI state. Selection is lifted to the shell so
// the editor can read it.
//
// Rename is intentionally absent: there is no rename channel in the backend yet (see
// docs/plans/03-assemble-the-app.md §4.1).

import { useCallback, useMemo, useState } from 'react'
import type { DraftNode, TreeNodeModel } from './explorer-view-types'
import { joinPath, parentPath } from './explorer-tree'
import { buildTree } from './explorer-tree-build'
import { useFolderListings } from './useFolderListings'
import { useExplorerCommands } from './useExplorerCommands'

type ExplorerTree = {
  readonly tree: readonly TreeNodeModel[]
  readonly draft: DraftNode | null
  readonly toggle: (path: string) => void
  readonly beginCreate: (type: 'file' | 'directory', parent: string | null) => void
  readonly commitDraft: (name: string) => void
  readonly cancelDraft: () => void
  readonly remove: (path: string) => void
}

export function useExplorerTree(root: string, onSelect: (path: string) => void): ExplorerTree {
  const { create, remove: removeEntry } = useExplorerCommands(root)
  const [openPaths, setOpenPaths] = useState<ReadonlySet<string>>(() => new Set())
  const [draft, setDraft] = useState<DraftNode | null>(null)

  const paths = useMemo(() => [root, ...openPaths], [root, openPaths])
  const lookup = useFolderListings(paths)
  const tree = useMemo(() => buildTree({ root, openPaths, lookup }), [root, openPaths, lookup])

  const toggle = useCallback((path: string): void => {
    setOpenPaths((prev) => toggleInSet(prev, path))
  }, [])

  const commitDraft = useCallback(
    (name: string): void => {
      const current = draft
      setDraft(null)
      if (!current || name === '') return
      const parent = current.parentPath ?? root
      const path = joinPath(parent, name)
      void create({ type: current.type, path, parent }).then((ok) => {
        if (ok && current.type === 'file') onSelect(path)
      })
    },
    [draft, root, create, onSelect]
  )

  const remove = useCallback(
    (path: string): void => {
      const parent = parentPath(path)
      void removeEntry({
        type: findType(tree, path) ?? 'file',
        path,
        parent: parent && parent.startsWith(root) ? parent : root
      })
    },
    [tree, root, removeEntry]
  )

  return {
    tree,
    draft,
    toggle,
    beginCreate: (type, parent) => setDraft({ parentPath: parent, type }),
    commitDraft,
    cancelDraft: () => setDraft(null),
    remove
  }
}

function toggleInSet(set: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(set)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}

function findType(tree: readonly TreeNodeModel[], path: string): 'file' | 'directory' | undefined {
  for (const node of tree) {
    if (node.path === path) return node.type
    const found = node.children && findType(node.children, path)
    if (found) return found
  }
  return undefined
}
