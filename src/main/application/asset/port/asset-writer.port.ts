// Port for storing an image in the workspace assets folder. The use case depends on this interface,
// never on a concrete filesystem; the adapter implements it and tests provide an in-memory fake.
// writeImageAsset ensures the assets folder exists, names the file by its content, writes the bytes, and
// resolves to the path it wrote relative to the workspace root (e.g. "assets/<hash>.png").

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { AssetWriteFailed } from '../error/asset-write-failed'

export interface AssetWriterPort {
  readonly writeImageAsset: (input: {
    readonly workspaceRoot: string
    readonly extension: string
    readonly bytes: Uint8Array
  }) => Effect.Effect<string, AssetWriteFailed>
}

export const AssetWriter = Context.GenericTag<AssetWriterPort>('application/AssetWriter')
