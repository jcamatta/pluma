// The folder picker port: opens the native folder chooser and returns the chosen absolute path. Split
// from the reader/writer because picking a workspace root is neither a read of folder contents nor a
// write to them — it is the one IPC call the launcher and app shell make before any repository exists.
// Routing it through a port keeps the window.api bridge confined to the adapter, like every other call.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FolderPickError } from '../../../../shared/ipc/ipc-contract/folder'

interface FolderPickerPort {
  readonly pick: () => Promise<Result<string, FolderPickError>>
}

export type { FolderPickerPort }
