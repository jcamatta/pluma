// IPC endpoint for listing a folder's immediate children. Runs the listFolder use case with the live
// filesystem adapter through the shared runIpc wrapper, which logs the call and serializes the Effect
// outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FOLDER_LIST_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import type { FolderEntry, FolderListError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { listFolder } from '../../application/folder/usecase/list-folder'
import { FsFolderReaderLive } from '../../adapters/folder/fs-folder-reader'
import { runIpc } from '../shared/run-ipc'

export const handleListFolder = (
  path: string
): Promise<Result<ReadonlyArray<FolderEntry>, FolderListError>> =>
  runIpc({
    channel: FOLDER_LIST_CHANNEL,
    annotations: { path },
    effect: listFolder(path).pipe(
      Effect.provide(FsFolderReaderLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FolderReadFailed', path })
  })
