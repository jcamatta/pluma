// Provides the real explorer repositories (IPC-backed reader + writer) to the subtree. Built once and
// held in state so the ports are stable across renders. Tests wrap their tree in RepositoriesContext
// directly with in-memory fakes instead of this provider.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { RepositoriesContext } from './RepositoriesContext'
import type { Repositories } from './RepositoriesContext'
import { createFolderRepository } from './adapters/folder-repository.ipc'

export function RepositoriesProvider({
  children
}: {
  readonly children: ReactNode
}): React.JSX.Element {
  const [repos] = useState<Repositories>(() => createFolderRepository())
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>
}
