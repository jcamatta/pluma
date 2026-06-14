// Query hook: loads one thread's context occupancy for the meter on resume. Wraps useQuery keyed by
// ['thread-context', cwd, id], enabled only when a thread is selected. Its data is the IPC Result
// (value is the AgentContextUsage or null), and the caller branches on data.ok. The reader port is the
// seam — no window.api.

import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AgentContextUsage } from '../../../shared/agent/context-usage'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { ThreadReadError } from '../../../shared/ipc/ipc-contract/agent'
import { useThreadsRepo } from './ThreadsContext'
import { threadContextKey } from './threadKeys'

type ThreadContextResult = Result<AgentContextUsage | null, ThreadReadError>

function useThreadContext(
  cwd: string,
  id: string | null
): UseQueryResult<ThreadContextResult, Error> {
  const { reader } = useThreadsRepo()
  return useQuery<ThreadContextResult, Error>({
    queryKey: threadContextKey(cwd, id ?? ''),
    queryFn: () => reader.getThreadContext(cwd, id ?? ''),
    enabled: id !== null
  })
}

export { useThreadContext }
export type { ThreadContextResult }
