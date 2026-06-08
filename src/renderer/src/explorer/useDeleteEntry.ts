// Command hook: deletes a file or folder, then invalidates the parent folder's listing so the entry
// disappears. Wraps useMutation; the result is the IPC Result (ok: false is a value). The writer port
// is the seam. On ok: true the parent's ['folder', parent] query is invalidated.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { FileDeleteError } from '../../../shared/ipc/ipc-contract/file'
import type { FolderDeleteError } from '../../../shared/ipc/ipc-contract/folder'
import { useRepos } from './RepositoriesContext'
import { folderListingKey } from './folder-query-keys'

type DeleteVariables = {
  readonly type: 'file' | 'directory'
  readonly path: string
  readonly parent: string
}

type DeleteResult = Result<string, FileDeleteError | FolderDeleteError>

function useDeleteEntry(): {
  readonly remove: (variables: DeleteVariables) => Promise<DeleteResult>
} {
  const { writer } = useRepos()
  const queryClient = useQueryClient()

  const mutation = useMutation<DeleteResult, Error, DeleteVariables>({
    mutationFn: (variables) =>
      variables.type === 'directory'
        ? writer.deleteFolder(variables.path)
        : writer.deleteFile(variables.path),
    onSuccess: (result, variables) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: folderListingKey(variables.parent) })
      }
    }
  })

  return { remove: mutation.mutateAsync }
}

export { useDeleteEntry }
export type { DeleteVariables, DeleteResult }
