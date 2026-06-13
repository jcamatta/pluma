import { describe, expect, it } from 'vitest'
import { assetStoragePath } from '../asset-storage-path'

describe('assetStoragePath', () => {
  it('names the file by hash and extension under a forward-slashed assets path', () => {
    expect(assetStoragePath({ hash: 'abc123', extension: 'png' })).toStrictEqual({
      dir: 'assets',
      fileName: 'abc123.png',
      relativePath: 'assets/abc123.png'
    })
  })
})
