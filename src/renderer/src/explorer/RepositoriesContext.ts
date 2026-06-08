// Context carrying the explorer's repository ports (reader + writer) for the subtree. The provider
// supplies the real IPC-backed adapter; tests supply in-memory fakes. Hooks read the ports through
// useRepos and never touch window.api themselves — the port is the single seam.

import { createContext, useContext } from 'react'
import { invariant } from '../../../shared/invariant'
import type { FolderReaderPort } from './ports/folder-reader.port'
import type { FolderWriterPort } from './ports/folder-writer.port'
import type { FileReaderPort } from './ports/file-reader.port'

interface Repositories {
  readonly reader: FolderReaderPort
  readonly writer: FolderWriterPort
  readonly fileReader: FileReaderPort
}

const RepositoriesContext = createContext<Repositories | undefined>(undefined)

function useRepos(): Repositories {
  const repos = useContext(RepositoriesContext)
  invariant(repos, 'useRepos must be used within a RepositoriesProvider')
  return repos
}

export { RepositoriesContext, useRepos }
export type { Repositories }
