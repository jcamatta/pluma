// Query hook for a single file's content. Given the selected file path (or null when nothing is
// selected), it runs one ['file', path] query via the file reader port and returns the IPC Result, or
// undefined while loading / when no file is selected. The port is the seam — no window.api. This is the
// read side the editor loads its content from; it never mutates.

import { useQuery } from '@tanstack/react-query'
import type { Result } from '../../../shared/ipc/ipc-result'
import type { FileReadError } from '../../../shared/ipc/ipc-contract/file'
import { useRepos } from './RepositoriesContext'
import { fileContentKey } from './file-query-keys'

function useFileContent(path: string | null): Result<string, FileReadError> | undefined {
  const { fileReader } = useRepos()
  const query = useQuery({
    queryKey: fileContentKey(path ?? ''),
    queryFn: () => fileReader.read(path ?? ''),
    enabled: path !== null
  })
  return query.data
}

export { useFileContent }
