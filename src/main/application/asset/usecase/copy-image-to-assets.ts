// Use case: store an inserted/pasted image in the workspace assets folder. Validates the MIME type to a
// known image extension (rejecting anything we do not store), then delegates the content-named write to
// the AssetWriter port. Resolves to the workspace-relative path the markdown should reference.

import * as Effect from 'effect/Effect'
import { UnsupportedImageType } from '../error/unsupported-image-type'
import type { AssetWriteFailed } from '../error/asset-write-failed'
import { AssetWriter } from '../port/asset-writer.port'
import type { AssetWriterPort } from '../port/asset-writer.port'
import { imageExtensionForMime } from '../logic/image-extension-for-mime'

export const copyImageToAssets = (input: {
  readonly workspaceRoot: string
  readonly bytes: Uint8Array
  readonly mimeType: string
}): Effect.Effect<string, UnsupportedImageType | AssetWriteFailed, AssetWriterPort> =>
  Effect.gen(function* () {
    const extension = imageExtensionForMime(input.mimeType)
    if (extension === null) {
      return yield* new UnsupportedImageType({ mimeType: input.mimeType })
    }
    const writer = yield* AssetWriter
    return yield* writer.writeImageAsset({
      workspaceRoot: input.workspaceRoot,
      extension,
      bytes: input.bytes
    })
  })
