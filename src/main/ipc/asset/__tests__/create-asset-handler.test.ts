// Tests for the create-asset IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the relative path (and the file on disk) on success, ok:false with a tagged error
// for an unsupported image type.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleCreateAsset } from '../create-asset-handler'

const bytes = new Uint8Array([137, 80, 78, 71, 9, 8, 7])

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleCreateAsset', () => {
  it('returns ok:true with the relative path and writes the bytes', () =>
    withTempDir(async (dir) => {
      const result = await handleCreateAsset({ workspaceRoot: dir, bytes, mimeType: 'image/png' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toMatch(/^assets\/[0-9a-f]{64}\.png$/)
      expect(new Uint8Array(readFileSync(join(dir, result.value)))).toStrictEqual(bytes)
    }))

  it('returns ok:false with UnsupportedImageType for a type we do not store', () =>
    withTempDir(async (dir) => {
      const result = await handleCreateAsset({ workspaceRoot: dir, bytes, mimeType: 'image/heic' })

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'UnsupportedImageType', mimeType: 'image/heic' }
      })
    }))
})
