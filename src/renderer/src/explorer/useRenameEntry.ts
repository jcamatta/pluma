// Command hook: renames a file or folder, then invalidates the parent folder's listing so the row
// re-lists with the new name. Branches on type just as create/delete do. Wraps useMutation; the result
// is the IPC Result (ok: false is a value the caller branches on). The writer port is the seam. On
// ok: true the parent's ['folder', parent] query is invalidated; never on ok: false. The open-folder /
// selection remap that a rename also requires lives in useExplorerTree (the tree-state side), not here.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { FolderRenameError } from '../../../shared/ipc/ipc-contract/folder'
import type { FileRenameError } from '../../../shared/ipc/ipc-contract/file'
import { useRepos } from './RepositoriesContext'
import { folderListingKey } from './folder-query-keys'

type RenameVariables = {
  readonly type: 'file' | 'directory'
  readonly oldPath: string
  readonly newPath: string
  readonly parent: string
}

type RenameResult = Result<string, FileRenameError | FolderRenameError>

function useRenameEntry(): {
  readonly rename: (variables: RenameVariables) => Promise<RenameResult>
} {
  const { writer } = useRepos()
  const queryClient = useQueryClient()

  const mutation = useMutation<RenameResult, Error, RenameVariables>({
    mutationFn: (variables) =>
      variables.type === 'directory'
        ? writer.renameFolder(variables.oldPath, variables.newPath)
        : writer.renameFile(variables.oldPath, variables.newPath),
    onSuccess: (result, variables) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: folderListingKey(variables.parent) })
      }
    }
  })

  return { rename: mutation.mutateAsync }
}

export { useRenameEntry }
export type { RenameVariables, RenameResult }
