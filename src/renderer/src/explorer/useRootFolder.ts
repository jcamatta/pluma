// Owns the picked root folder for the workspace. Opens the native folder picker via IPC and exposes the
// chosen absolute path. Lives as a hook (a .ts module) so the App shell stays free of direct window.api
// use; the picker is the workspace root every file/folder operation is relative to.

import { useCallback, useState } from 'react'
import { FOLDER_PICK_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'

type RootFolder = {
  readonly root: string | null
  readonly pick: () => Promise<void>
}

export function useRootFolder(): RootFolder {
  const [root, setRoot] = useState<string | null>(null)

  const pick = useCallback(async (): Promise<void> => {
    const result = await window.api.invoke(FOLDER_PICK_CHANNEL)
    if (result.ok) setRoot(result.value)
  }, [])

  return { root, pick }
}
