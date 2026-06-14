// The threads feature's query port: lists the workspace's past threads and loads one thread's history.
// Split from the writer per CQS. Returns the IPC Result unchanged; ok: false is a value the UI branches
// on, never a thrown error.

import type { Message } from '@ag-ui/core'
import type { Result } from '../../../../shared/ipc/ipc-result'
import type { AgentContextUsage } from '../../../../shared/agent/context-usage'
import type { ThreadReadError, ThreadSummary } from '../../../../shared/ipc/ipc-contract/agent'

interface ThreadsReaderPort {
  readonly listThreads: (cwd: string) => Promise<Result<readonly ThreadSummary[], ThreadReadError>>
  readonly getThreadHistory: (
    cwd: string,
    id: string
  ) => Promise<Result<readonly Message[], ThreadReadError>>
  readonly getThreadContext: (
    cwd: string,
    id: string
  ) => Promise<Result<AgentContextUsage | null, ThreadReadError>>
}

export type { ThreadsReaderPort }
