// The real threads repository adapter: implements the reader and writer ports over the preload
// window.api bridge. It passes each IPC Result through unchanged (ok: false is a value, not an error).
// This is the only threads module that touches window.api; everything above it depends on the ports.

import {
  AGENT_DELETE_THREAD_CHANNEL,
  AGENT_LIST_THREADS_CHANNEL,
  AGENT_RENAME_THREAD_CHANNEL,
  AGENT_THREAD_HISTORY_CHANNEL
} from '../../../../shared/ipc/ipc-contract/agent'
import type { ThreadsReaderPort } from '../ports/threads-reader.port'
import type { ThreadsWriterPort } from '../ports/threads-writer.port'

function createThreadsRepository(): {
  readonly reader: ThreadsReaderPort
  readonly writer: ThreadsWriterPort
} {
  const reader: ThreadsReaderPort = {
    listThreads: (cwd) => window.api.invoke(AGENT_LIST_THREADS_CHANNEL, { cwd }),
    getThreadHistory: (cwd, id) =>
      window.api.invoke(AGENT_THREAD_HISTORY_CHANNEL, { cwd, threadId: id })
  }

  const writer: ThreadsWriterPort = {
    renameThread: (args) =>
      window.api.invoke(AGENT_RENAME_THREAD_CHANNEL, {
        cwd: args.cwd,
        threadId: args.id,
        title: args.title
      }),
    deleteThread: (cwd, id) => window.api.invoke(AGENT_DELETE_THREAD_CHANNEL, { cwd, threadId: id })
  }

  return { reader, writer }
}

export { createThreadsRepository }
