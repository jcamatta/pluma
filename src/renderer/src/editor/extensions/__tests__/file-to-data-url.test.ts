// fileToDataUrl encodes a file's bytes into a base64 data URL carrying the file's mime type.

import { describe, expect, it } from 'vitest'
import { fileToDataUrl } from '../file-to-data-url'

describe('fileToDataUrl', () => {
  it('encodes a png file to a base64 data url', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const url = await fileToDataUrl(file)
    expect(url?.startsWith('data:image/png;base64,')).toBe(true)
  })
})
