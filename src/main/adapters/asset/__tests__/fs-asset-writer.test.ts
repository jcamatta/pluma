// Tests for the FileSystem-backed AssetWriter adapter against a real temp directory. Verifies it creates
// the assets folder and writes the bytes, returns a content-hashed relative path, and resolves identical
// bytes to the same path (dedup / idempotent write).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { AssetWriter } from '../../../application/asset/port/asset-writer.port'
import { FsAssetWriterLive } from '../fs-asset-writer'

const run = (input: {
  workspaceRoot: string
  extension: string
  bytes: Uint8Array
}): Promise<Exit.Exit<string, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(AssetWriter, (writer) => writer.writeImageAsset(input)).pipe(
      Effect.provide(FsAssetWriterLive),
      Effect.provide(NodeContext.layer)
    )
  )

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

describe('FsAssetWriterLive writeImageAsset', () => {
  it('creates the assets folder and writes the bytes, returning a content-hashed relative path', () =>
    withTempDir(async (dir) => {
      const exit = await run({ workspaceRoot: dir, extension: 'png', bytes })

      expect(Exit.isSuccess(exit)).toBe(true)
      if (!Exit.isSuccess(exit)) return
      expect(exit.value).toMatch(/^assets\/[0-9a-f]{64}\.png$/)
      expect(new Uint8Array(readFileSync(join(dir, exit.value)))).toStrictEqual(bytes)
    }))

  it('resolves identical bytes to the same path', () =>
    withTempDir(async (dir) => {
      const first = await run({ workspaceRoot: dir, extension: 'png', bytes })
      const second = await run({ workspaceRoot: dir, extension: 'png', bytes })

      expect(first).toStrictEqual(second)
    }))
})
