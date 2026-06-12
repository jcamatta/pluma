// Command hook: deletes a thread, then invalidates the workspace's thread list so the row disappears.
// Wraps useMutation; the result is the IPC Result (ok: false is a value the caller branches on). The
// writer port is the seam. On ok: true the ['threads', cwd] query is invalidated; never on ok: false.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { ThreadWriteError } from '../../../shared/ipc/ipc-contract/agent'
import { useThreadsRepo } from './ThreadsContext'
import { threadsKey } from './threadKeys'

type DeleteVariables = {
  readonly cwd: string
  readonly id: string
}

type DeleteResult = Result<null, ThreadWriteError>

function useDeleteThread(): {
  readonly remove: (variables: DeleteVariables) => Promise<DeleteResult>
} {
  const { writer } = useThreadsRepo()
  const queryClient = useQueryClient()

  const mutation = useMutation<DeleteResult, Error, DeleteVariables>({
    mutationFn: (variables) => writer.deleteThread(variables.cwd, variables.id),
    onSuccess: (result, variables) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: threadsKey(variables.cwd) })
      }
    }
  })

  return { remove: mutation.mutateAsync }
}

export { useDeleteThread }
export type { DeleteVariables, DeleteResult }
