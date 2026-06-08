// Command hook: creates a file or folder, then invalidates the parent folder's listing so the new
// entry appears. Wraps useMutation; the result is the IPC Result (ok: false is a value, not a thrown
// error). The writer port is the seam. On ok: true the parent's ['folder', parent] query is
// invalidated; the caller decides what else to do with the returned Result (e.g. select a new file).

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { FileCreateError } from '../../../shared/ipc/ipc-contract/file'
import type { FolderCreateError } from '../../../shared/ipc/ipc-contract/folder'
import { useRepos } from './RepositoriesContext'
import { folderListingKey } from './folder-query-keys'

type CreateVariables = {
  readonly type: 'file' | 'directory'
  readonly path: string
  readonly parent: string
}

type CreateResult = Result<string, FileCreateError | FolderCreateError>

function useCreateEntry(): {
  readonly create: (variables: CreateVariables) => Promise<CreateResult>
} {
  const { writer } = useRepos()
  const queryClient = useQueryClient()

  const mutation = useMutation<CreateResult, Error, CreateVariables>({
    mutationFn: (variables) =>
      variables.type === 'directory'
        ? writer.createFolder(variables.path)
        : writer.createFile(variables.path),
    onSuccess: (result, variables) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: folderListingKey(variables.parent) })
      }
    }
  })

  return { create: mutation.mutateAsync }
}

export { useCreateEntry }
export type { CreateVariables, CreateResult }
