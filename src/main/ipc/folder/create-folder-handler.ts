// IPC endpoint for creating a folder. Runs the createFolder use case with the live filesystem adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FOLDER_CREATE_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import type { FolderCreateError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { createFolder } from '../../application/folder/usecase/create-folder'
import { FsFolderWriterLive } from '../../adapters/folder/fs-folder-writer'
import { runIpc } from '../shared/run-ipc'

export const handleCreateFolder = (path: string): Promise<Result<string, FolderCreateError>> =>
  runIpc({
    channel: FOLDER_CREATE_CHANNEL,
    annotations: { path },
    effect: createFolder(path).pipe(
      Effect.provide(FsFolderWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FolderCreationFailed', path })
  })
