// The launcher's folder.pick command: opens the native folder chooser through the picker port and, on
// success, hands the chosen absolute path to the caller (the app shell, which makes it the workspace
// root). Reads the port through useRepos so the launcher never touches window.api directly; a cancelled
// or failed pick is a no-op (the launcher simply stays on screen).

import { useCallback } from 'react'
import { useRepos } from '../explorer/RepositoriesContext'

type FolderPick = {
  readonly pick: () => Promise<void>
}

function useFolderPick(onPicked: (path: string) => void): FolderPick {
  const { picker } = useRepos()
  const pick = useCallback(async (): Promise<void> => {
    const result = await picker.pick()
    if (result.ok) onPicked(result.value)
  }, [picker, onPicked])

  return { pick }
}

export { useFolderPick }
export type { FolderPick }
