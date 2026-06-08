// Exposes the file writer port's write as a stable callback for the editor's autosave. The port is the
// seam — no window.api. This is the write side the editor persists its content through; it returns the
// port's Result unchanged so callers can branch on ok: false.

import { useCallback } from 'react'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { FileWriteError } from '../../../shared/ipc/ipc-contract/file'
import { useRepos } from './RepositoriesContext'

function useFileWrite(): (
  path: string,
  content: string
) => Promise<Result<string, FileWriteError>> {
  const { fileWriter } = useRepos()
  return useCallback(
    (path: string, content: string) => fileWriter.write(path, content),
    [fileWriter]
  )
}

export { useFileWrite }
