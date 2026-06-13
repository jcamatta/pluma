// Keeps the open-files set honest against the filesystem: when the OS watcher reports a file or folder
// was deleted, the matching open file is closed so its editor unmounts instead of lingering as a
// writable surface that would resurrect the file on the next autosave. Subscribes to the watcher's
// folder:changed stream through the writer port and prunes on a 'deleted' change.

import { useEffect } from 'react'
import { useRepos } from '../explorer/RepositoriesContext'
import { useOpenFiles } from './OpenFilesContext'

function useCloseDeletedFiles(): void {
  const { writer } = useRepos()
  const { close } = useOpenFiles()
  useEffect(
    () =>
      writer.onChange((change) => {
        if (change.type === 'deleted') close(change.path)
      }),
    [writer, close]
  )
}

export { useCloseDeletedFiles }
