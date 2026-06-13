// Wire contract for the asset channel. asset:create copies image bytes into the workspace's managed
// assets folder and resolves to the new path, relative to the workspace root, that the markdown
// references. The error shape is the serialized tagged error the main handler produces from the use
// case; it is declared here (not imported from the application layer) so the wire contract stays
// independent of main internals and the renderer can read it.

import type { IpcContractDefinition } from './types'

const ASSET_CREATE_CHANNEL = 'asset:create'

interface AssetCreateRequest {
  readonly workspaceRoot: string
  readonly bytes: Uint8Array
  readonly mimeType: string
}

type AssetCreateError =
  | { readonly _tag: 'UnsupportedImageType'; readonly mimeType: string }
  | { readonly _tag: 'AssetWriteFailed'; readonly path: string }

type AssetCreateContract = IpcContractDefinition<
  typeof ASSET_CREATE_CHANNEL,
  AssetCreateRequest,
  string,
  AssetCreateError
>

export {
  ASSET_CREATE_CHANNEL,
  type AssetCreateRequest,
  type AssetCreateError,
  type AssetCreateContract
}
