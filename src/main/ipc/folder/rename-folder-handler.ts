// IPC endpoint for renaming a folder. Runs the renameFolder use case with the live filesystem adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FOLDER_RENAME_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import type {
  FolderRenameError,
  FolderRenameRequest
} from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { renameFolder } from '../../application/folder/usecase/rename-folder'
import { FsFolderWriterLive } from '../../adapters/folder/fs-folder-writer'
import { runIpc } from '../shared/run-ipc'

export const handleRenameFolder = ({
  oldPath,
  newPath
}: FolderRenameRequest): Promise<Result<string, FolderRenameError>> =>
  runIpc({
    channel: FOLDER_RENAME_CHANNEL,
    annotations: { oldPath, newPath },
    effect: renameFolder(oldPath, newPath).pipe(
      Effect.provide(FsFolderWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FolderRenameFailed', path: newPath })
  })
