// In-memory fake of the threads repositories (reader + writer) for hook and controller tests. Resolves
// IPC Results from seeded data without window.api or Electron. Tests spy on the returned ports to assert
// which method ran; the writer succeeds by default. The single seam the threads hooks depend on.

import type { Message } from '@ag-ui/core'
import type { ThreadSummary } from '../../../../shared/ipc/ipc-contract/agent'
import type { ThreadsRepositories } from '../ThreadsContext'
import type { ThreadsReaderPort } from '../ports/threads-reader.port'
import type { ThreadsWriterPort } from '../ports/threads-writer.port'

interface Seed {
  readonly threads?: readonly ThreadSummary[]
  readonly history?: readonly Message[]
}

function createFakeThreadsRepository(seed: Seed = {}): ThreadsRepositories {
  const reader: ThreadsReaderPort = {
    listThreads: () => Promise.resolve({ ok: true, value: seed.threads ?? [] }),
    getThreadHistory: () => Promise.resolve({ ok: true, value: seed.history ?? [] })
  }

  const writer: ThreadsWriterPort = {
    renameThread: () => Promise.resolve({ ok: true, value: null }),
    deleteThread: () => Promise.resolve({ ok: true, value: null })
  }

  return { reader, writer }
}

export { createFakeThreadsRepository }
export type { Seed }
