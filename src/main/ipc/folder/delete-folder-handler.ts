// IPC endpoint for deleting a folder. Runs the deleteFolder use case with the live filesystem adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FOLDER_DELETE_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import type { FolderDeleteError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { deleteFolder } from '../../application/folder/usecase/delete-folder'
import { FsFolderWriterLive } from '../../adapters/folder/fs-folder-writer'
import { runIpc } from '../shared/run-ipc'

export const handleDeleteFolder = (path: string): Promise<Result<string, FolderDeleteError>> =>
  runIpc({
    channel: FOLDER_DELETE_CHANNEL,
    annotations: { path },
    effect: deleteFolder(path).pipe(
      Effect.provide(FsFolderWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FolderDeleteFailed', path })
  })
