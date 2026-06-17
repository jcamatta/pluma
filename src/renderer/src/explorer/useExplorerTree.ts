// Orchestrates the explorer's lazily-loaded tree on top of React Query. Open folders are local UI state
// (a Set of paths); their listings come from useFolderListings (one ['folder', path] query per open
// path). The tree the view renders is a pure build (buildTree) from the open-set and those listings.
// The write side (create/delete/rename + the OS watcher) lives in useExplorerCommands, kept apart per
// CQS; this hook owns the read/tree side plus the draft/open/renaming UI state. Selection is lifted to
// the shell so the editor can read it.
//
// Renaming a folder changes the path of the folder and every descendant, so on success the open-folder
// set and (if it points inside the renamed subtree) the selected file are remapped onto the new root.

import { useCallback, useMemo, useState } from 'react'
import type { DraftNode, TreeNodeModel } from './explorer-view-types'
import { joinPath, parentPath } from './explorer-tree'
import { buildTree } from './explorer-tree-build'
import { isUnderOrEqual, remapOpenPaths, remapPath } from './explorer-subtree-remap'
import { useFolderListings } from './useFolderListings'
import { useExplorerCommands } from './useExplorerCommands'

type ExplorerTree = {
  readonly tree: readonly TreeNodeModel[]
  readonly isLoading: boolean
  readonly draft: DraftNode | null
  readonly renamingPath: string | null
  readonly toggle: (path: string) => void
  readonly beginCreate: (type: 'file' | 'directory', parent: string | null) => void
  readonly commitDraft: (name: string) => void
  readonly cancelDraft: () => void
  readonly remove: (path: string) => void
  readonly beginRename: (path: string) => void
  readonly commitRename: (name: string) => void
  readonly cancelRename: () => void
}

type Selection = {
  readonly selected: string | null
  readonly onSelect: (path: string) => void
}

export function useExplorerTree(root: string, selection: Selection): ExplorerTree {
  const { create, remove: removeEntry, rename } = useExplorerCommands(root)
  const [openPaths, setOpenPaths] = useState<ReadonlySet<string>>(() => new Set())
  const [draft, setDraft] = useState<DraftNode | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)

  const paths = useMemo(() => [root, ...openPaths], [root, openPaths])
  const { lookup, isPending } = useFolderListings(paths)
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
      void create({ type: current.type, path, parent }).then((created) => {
        if (created !== null && current.type === 'file') selection.onSelect(created)
      })
    },
    [draft, root, create, selection]
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

  const commitRename = useCallback(
    (name: string): void => {
      const path = renamingPath
      setRenamingPath(null)
      if (!path) return
      const parent = parentPath(path)
      const scopedParent = parent && parent.startsWith(root) ? parent : root
      const newPath = joinPath(scopedParent, name)
      if (name === '' || newPath === path) return
      const type = findType(tree, path) ?? 'file'
      void rename({ type, oldPath: path, newPath, parent: scopedParent }).then((ok) => {
        if (!ok) return
        const remap = { from: path, to: newPath }
        setOpenPaths((prev) => remapOpenPaths(prev, remap))
        const sel = selection.selected
        if (sel && isUnderOrEqual(sel, path)) selection.onSelect(remapPath(sel, remap))
      })
    },
    [renamingPath, tree, root, rename, selection]
  )

  return {
    tree,
    isLoading: isPending(root),
    draft,
    renamingPath,
    toggle,
    beginCreate: (type, parent) => {
      if (parent !== null) setOpenPaths((prev) => withPath(prev, parent))
      setDraft({ parentPath: parent, type })
    },
    commitDraft,
    cancelDraft: () => setDraft(null),
    remove,
    beginRename: (path) => setRenamingPath(path),
    commitRename,
    cancelRename: () => setRenamingPath(null)
  }
}

function toggleInSet(set: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(set)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}

function withPath(set: ReadonlySet<string>, path: string): ReadonlySet<string> {
  if (set.has(path)) return set
  const next = new Set(set)
  next.add(path)
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
