// Query hook: lists the workspace's past threads. Wraps useQuery keyed by ['threads', cwd]; its data is
// the IPC Result, and the UI branches on data.ok. The reader port is the seam — no window.api. Reads
// are scoped to the open workspace folder passed in (the same source the agent run uses for cwd).

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { ThreadReadError, ThreadSummary } from '../../../shared/ipc/ipc-contract/agent'
import { useThreadsRepo } from './ThreadsContext'
import { threadsKey } from './threadKeys'

type ThreadsResult = Result<readonly ThreadSummary[], ThreadReadError>

function useThreads(cwd: string): UseQueryResult<ThreadsResult, Error> {
  const { reader } = useThreadsRepo()
  return useQuery<ThreadsResult, Error>({
    queryKey: threadsKey(cwd),
    queryFn: () => reader.listThreads(cwd)
  })
}

export { useThreads }
export type { ThreadsResult }
