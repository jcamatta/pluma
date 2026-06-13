// Tests for copyImageToAssets against an in-memory AssetWriter fake. Covers the success path (returns the
// relative path the writer reports), the unsupported-type rejection (writer untouched), and propagation
// of a write failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { AssetWriteFailed } from '../../error/asset-write-failed'
import { copyImageToAssets } from '../copy-image-to-assets'
import { AssetWriter } from '../../port/asset-writer.port'
import type { AssetWriterPort } from '../../port/asset-writer.port'

type WriteCall = { workspaceRoot: string; extension: string; bytes: Uint8Array }

const bytes = new Uint8Array([1, 2, 3])

const writerThatSucceeds = (calls: WriteCall[]): Layer.Layer<AssetWriterPort> =>
  Layer.succeed(
    AssetWriter,
    AssetWriter.of({
      writeImageAsset: (input) =>
        Effect.sync(() => {
          calls.push(input)
          return `assets/hash.${input.extension}`
        })
    })
  )

const writerThatFails = (error: AssetWriteFailed): Layer.Layer<AssetWriterPort> =>
  Layer.succeed(
    AssetWriter,
    AssetWriter.of({
      writeImageAsset: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, AssetWriterPort>,
  layer: Layer.Layer<AssetWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('copyImageToAssets', () => {
  it('writes the image and returns the relative path on success', () => {
    const calls: WriteCall[] = []
    const exit = run(
      copyImageToAssets({ workspaceRoot: '/ws', bytes, mimeType: 'image/png' }),
      writerThatSucceeds(calls)
    )

    expect(exit).toStrictEqual(Exit.succeed('assets/hash.png'))
    expect(calls).toStrictEqual([{ workspaceRoot: '/ws', extension: 'png', bytes }])
  })

  it('maps the mime type to its extension before delegating', () => {
    const calls: WriteCall[] = []
    run(
      copyImageToAssets({ workspaceRoot: '/ws', bytes, mimeType: 'image/jpeg' }),
      writerThatSucceeds(calls)
    )

    expect(calls).toStrictEqual([{ workspaceRoot: '/ws', extension: 'jpg', bytes }])
  })

  it('rejects an unsupported image type without touching the writer', () => {
    const calls: WriteCall[] = []
    const exit = run(
      copyImageToAssets({ workspaceRoot: '/ws', bytes, mimeType: 'image/heic' }),
      writerThatSucceeds(calls)
    )

    expect(calls).toStrictEqual([])
    expect(exit).toStrictEqual(
      Exit.fail(expect.objectContaining({ _tag: 'UnsupportedImageType', mimeType: 'image/heic' }))
    )
  })

  it('propagates AssetWriteFailed from the writer', () => {
    const error = new AssetWriteFailed({ path: 'assets/hash.png' })
    const exit = run(
      copyImageToAssets({ workspaceRoot: '/ws', bytes, mimeType: 'image/png' }),
      writerThatFails(error)
    )
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
