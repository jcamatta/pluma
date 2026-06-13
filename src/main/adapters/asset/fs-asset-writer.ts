// AssetWriter adapter backed by the platform FileSystem. The only place that writes image bytes to disk.
// Names the file by its content hash, ensures the workspace assets directory exists (a no-op if it
// already does), writes the bytes, and resolves to the workspace-relative path the markdown references.
// Any filesystem failure — including the assets path already existing as a regular file — maps to the
// domain's AssetWriteFailed.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { AssetWriteFailed } from '../../application/asset/error/asset-write-failed'
import { AssetWriter } from '../../application/asset/port/asset-writer.port'
import { sha256Hex } from './content-hash'
import { assetStoragePath } from './asset-storage-path'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem
  const path = yield* Path

  const writeImageAsset = (input: {
    readonly workspaceRoot: string
    readonly extension: string
    readonly bytes: Uint8Array
  }): Effect.Effect<string, AssetWriteFailed> => {
    const { dir, fileName, relativePath } = assetStoragePath({
      hash: sha256Hex(input.bytes),
      extension: input.extension
    })
    const assetsDir = path.join(input.workspaceRoot, dir)
    const target = path.join(assetsDir, fileName)

    return fs.makeDirectory(assetsDir, { recursive: true }).pipe(
      Effect.zipRight(fs.writeFile(target, input.bytes)),
      Effect.as(relativePath),
      Effect.mapError(() => new AssetWriteFailed({ path: relativePath }))
    )
  }

  return AssetWriter.of({ writeImageAsset })
})

export const FsAssetWriterLive = Layer.effect(AssetWriter, make)
