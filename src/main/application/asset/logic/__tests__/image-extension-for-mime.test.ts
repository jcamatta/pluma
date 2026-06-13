import { describe, expect, it } from 'vitest'
import { imageExtensionForMime } from '../image-extension-for-mime'

describe('imageExtensionForMime', () => {
  it('maps supported image mime types to their stored extension', () => {
    expect(imageExtensionForMime('image/png')).toBe('png')
    expect(imageExtensionForMime('image/jpeg')).toBe('jpg')
    expect(imageExtensionForMime('image/gif')).toBe('gif')
    expect(imageExtensionForMime('image/webp')).toBe('webp')
  })

  it('returns null for unsupported or non-image types', () => {
    expect(imageExtensionForMime('image/heic')).toBeNull()
    expect(imageExtensionForMime('image/tiff')).toBeNull()
    expect(imageExtensionForMime('application/pdf')).toBeNull()
    expect(imageExtensionForMime('')).toBeNull()
  })
})
