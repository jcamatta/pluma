// Event contract for filesystem changes under a watched folder. Main pushes one of these on
// folder:changed for each create/update/delete; the renderer subscribes via window.api.on.

import type { IpcEventContractDefinition } from './types'

const FOLDER_CHANGED_CHANNEL = 'folder:changed'

interface FolderChange {
  readonly type: 'created' | 'updated' | 'deleted'
  readonly path: string
}

type FolderChangedContract = IpcEventContractDefinition<typeof FOLDER_CHANGED_CHANNEL, FolderChange>

export { FOLDER_CHANGED_CHANNEL, type FolderChange, type FolderChangedContract }
