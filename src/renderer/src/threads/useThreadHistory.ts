// Query hook: loads one thread's message history. Wraps useQuery keyed by ['thread-history', cwd, id],
// enabled only when a thread is selected (id is non-null). Its data is the IPC Result, and the UI
// branches on data.ok. The reader port is the seam — no window.api.

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Message } from '@ag-ui/core'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { ThreadReadError } from '../../../shared/ipc/ipc-contract/agent'
import { useThreadsRepo } from './ThreadsContext'
import { threadHistoryKey } from './threadKeys'

type ThreadHistoryResult = Result<readonly Message[], ThreadReadError>

function useThreadHistory(
  cwd: string,
  id: string | null
): UseQueryResult<ThreadHistoryResult, Error> {
  const { reader } = useThreadsRepo()
  return useQuery<ThreadHistoryResult, Error>({
    queryKey: threadHistoryKey(cwd, id ?? ''),
    queryFn: () => reader.getThreadHistory(cwd, id ?? ''),
    enabled: id !== null
  })
}

export { useThreadHistory }
export type { ThreadHistoryResult }
