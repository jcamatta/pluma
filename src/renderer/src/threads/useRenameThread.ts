// Command hook: renames a thread, then invalidates the workspace's thread list so the new title shows.
// Wraps useMutation; the result is the IPC Result (ok: false is a value the caller branches on). The
// writer port is the seam. On ok: true the ['threads', cwd] query is invalidated; never on ok: false.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { ThreadWriteError } from '../../../shared/ipc/ipc-contract/agent'
import { useThreadsRepo } from './ThreadsContext'
import { threadsKey } from './threadKeys'

type RenameVariables = {
  readonly cwd: string
  readonly id: string
  readonly title: string
}

type RenameResult = Result<null, ThreadWriteError>

function useRenameThread(): {
  readonly rename: (variables: RenameVariables) => Promise<RenameResult>
} {
  const { writer } = useThreadsRepo()
  const queryClient = useQueryClient()

  const mutation = useMutation<RenameResult, Error, RenameVariables>({
    mutationFn: (variables) =>
      writer.renameThread({ cwd: variables.cwd, id: variables.id, title: variables.title }),
    onSuccess: (result, variables) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: threadsKey(variables.cwd) })
      }
    }
  })

  return { rename: mutation.mutateAsync }
}

export { useRenameThread }
export type { RenameVariables, RenameResult }
