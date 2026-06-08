// The launcher's folder.pick command: opens the native folder chooser over IPC and, on success, hands
// the chosen absolute path to the caller (the app shell, which makes it the workspace root). Lives as a
// hook so the launcher controller stays free of direct window.api use; a cancelled or failed pick is a
// no-op (the launcher simply stays on screen).

import { useCallback } from 'react'
import { FOLDER_PICK_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'

type FolderPick = {
  readonly pick: () => Promise<void>
}

function useFolderPick(onPicked: (path: string) => void): FolderPick {
  const pick = useCallback(async (): Promise<void> => {
    const result = await window.api.invoke(FOLDER_PICK_CHANNEL)
    if (result.ok) onPicked(result.value)
  }, [onPicked])

  return { pick }
}

export { useFolderPick }
export type { FolderPick }
