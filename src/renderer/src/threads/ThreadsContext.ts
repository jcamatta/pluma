// Context carrying the threads feature's repository ports (reader + writer) for the subtree. The
// provider supplies the real IPC-backed adapter; tests supply in-memory fakes. Hooks read the ports
// through useThreadsRepo and never touch window.api themselves — the port is the single seam.

import { createContext, useContext } from 'react'
import { invariant } from '../../../shared/invariant'
import type { ThreadsReaderPort } from './ports/threads-reader.port'
import type { ThreadsWriterPort } from './ports/threads-writer.port'

interface ThreadsRepositories {
  readonly reader: ThreadsReaderPort
  readonly writer: ThreadsWriterPort
}

const ThreadsContext = createContext<ThreadsRepositories | undefined>(undefined)

function useThreadsRepo(): ThreadsRepositories {
  const repos = useContext(ThreadsContext)
  invariant(repos, 'useThreadsRepo must be used within a ThreadsProvider')
  return repos
}

export { ThreadsContext, useThreadsRepo }
export type { ThreadsRepositories }
