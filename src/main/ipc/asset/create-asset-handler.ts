// IPC endpoint for storing an inserted image in the workspace assets folder. Runs the copyImageToAssets
// use case with the live filesystem adapter through the shared runIpc wrapper, which logs the call and
// serializes the Effect outcome into a plain Result. Never throws across IPC. Only safe scalars are
// annotated — never the image bytes.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { ASSET_CREATE_CHANNEL } from '../../../shared/ipc/ipc-contract/asset'
import type { AssetCreateError, AssetCreateRequest } from '../../../shared/ipc/ipc-contract/asset'
import type { Result } from '../../../shared/ipc/ipc-result'
import { copyImageToAssets } from '../../application/asset/usecase/copy-image-to-assets'
import { FsAssetWriterLive } from '../../adapters/asset/fs-asset-writer'
import { runIpc } from '../shared/run-ipc'

export const handleCreateAsset = (
  request: AssetCreateRequest
): Promise<Result<string, AssetCreateError>> =>
  runIpc({
    channel: ASSET_CREATE_CHANNEL,
    annotations: { workspaceRoot: request.workspaceRoot, mimeType: request.mimeType },
    effect: copyImageToAssets(request).pipe(
      Effect.provide(FsAssetWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error): AssetCreateError =>
      error._tag === 'UnsupportedImageType'
        ? { _tag: error._tag, mimeType: error.mimeType }
        : { _tag: error._tag, path: error.path },
    onDefect: (): AssetCreateError => ({ _tag: 'AssetWriteFailed', path: request.workspaceRoot })
  })
