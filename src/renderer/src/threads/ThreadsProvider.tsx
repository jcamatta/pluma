// Provides the real threads repositories (IPC-backed reader + writer) to the subtree. Built once and
// held in state so the ports are stable across renders. Tests wrap their tree in ThreadsContext
// directly with in-memory fakes instead of this provider.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ThreadsContext } from './ThreadsContext'
import type { ThreadsRepositories } from './ThreadsContext'
import { createThreadsRepository } from './adapters/threads-repository.ipc'

export function ThreadsProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [repos] = useState<ThreadsRepositories>(() => createThreadsRepository())
  return <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
}
