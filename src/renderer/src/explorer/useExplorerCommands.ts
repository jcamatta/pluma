// The explorer's write side: create and delete entries, and the OS-watch wiring. Split from
// useExplorerTree (the read/tree side) per CQS. create/remove go through the command hooks, which
// invalidate the affected folder's ['folder', path] listing on ok: true; the watcher invalidates the
// changed folder so external filesystem changes re-list. createFile selection is lifted to the caller.

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parentPath } from './explorer-tree'
import { folderListingKey } from './folder-query-keys'
import { useRepos } from './RepositoriesContext'
import { useCreateEntry } from './useCreateEntry'
import { useDeleteEntry } from './useDeleteEntry'
import { useRenameEntry } from './useRenameEntry'

type ExplorerCommands = {
  readonly create: (args: {
    readonly type: 'file' | 'directory'
    readonly path: string
    readonly parent: string
  }) => Promise<boolean>
  readonly remove: (args: {
    readonly type: 'file' | 'directory'
    readonly path: string
    readonly parent: string
  }) => Promise<boolean>
  readonly rename: (args: {
    readonly type: 'file' | 'directory'
    readonly oldPath: string
    readonly newPath: string
    readonly parent: string
  }) => Promise<boolean>
}

function useExplorerCommands(root: string): ExplorerCommands {
  const { writer } = useRepos()
  const queryClient = useQueryClient()
  const { create: createEntry } = useCreateEntry()
  const { remove: deleteEntry } = useDeleteEntry()
  const { rename: renameEntry } = useRenameEntry()

  useEffect(() => {
    void writer.watch(root)
    return writer.onChange((change) => {
      const parent = parentPath(change.path)
      void queryClient.invalidateQueries({
        queryKey: folderListingKey(parent && parent.startsWith(root) ? parent : root)
      })
    })
  }, [root, writer, queryClient])

  const create = useCallback(
    (args: Parameters<ExplorerCommands['create']>[0]) =>
      createEntry(args).then((result) => result.ok),
    [createEntry]
  )

  const remove = useCallback(
    (args: Parameters<ExplorerCommands['remove']>[0]) =>
      deleteEntry(args).then((result) => result.ok),
    [deleteEntry]
  )

  const rename = useCallback(
    (args: Parameters<ExplorerCommands['rename']>[0]) =>
      renameEntry(args).then((result) => result.ok),
    [renameEntry]
  )

  return { create, remove, rename }
}

export { useExplorerCommands }
export type { ExplorerCommands }
