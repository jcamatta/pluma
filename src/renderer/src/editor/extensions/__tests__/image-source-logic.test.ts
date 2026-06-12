// Source-resolution logic: type filtering, htmlContent src extraction, and the GIF-prefer-url decision.

import { describe, expect, it } from 'vitest'
import { extractImageSrc, filterImageFiles, resolveImageSource } from '../image-source-logic'

function fakeFile(type: string, name = 'f'): File {
  return new File(['x'], name, { type })
}

describe('filterImageFiles', () => {
  it('keeps png, jpeg, gif and webp, drops everything else', () => {
    const files = [
      fakeFile('image/png'),
      fakeFile('image/jpeg'),
      fakeFile('image/gif'),
      fakeFile('image/webp'),
      fakeFile('text/plain'),
      fakeFile('application/pdf')
    ]
    expect(filterImageFiles(files).map((f) => f.type)).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ])
  })
})

describe('extractImageSrc', () => {
  it('returns the first img src in the html', () => {
    expect(extractImageSrc('<p>hi</p><img src="https://x.test/a.gif">')).toBe(
      'https://x.test/a.gif'
    )
  })

  it('returns null when there is no img or src', () => {
    expect(extractImageSrc('<p>no image here</p>')).toBeNull()
    expect(extractImageSrc('<img alt="missing src">')).toBeNull()
  })
})

describe('resolveImageSource', () => {
  it('prefers the html url over the file (the pasted-gif case)', () => {
    const source = resolveImageSource({
      files: [fakeFile('image/png')],
      htmlContent: '<img src="https://x.test/a.gif">'
    })
    expect(source).toEqual({ kind: 'url', src: 'https://x.test/a.gif' })
  })

  it('uses the first image file when there is no html (drag-drop)', () => {
    const file = fakeFile('image/png')
    expect(resolveImageSource({ files: [file] })).toEqual({ kind: 'file', file })
  })

  it('returns null when nothing usable is present', () => {
    expect(resolveImageSource({ files: [fakeFile('text/plain')] })).toBeNull()
    expect(resolveImageSource({ files: [], htmlContent: '<p>no image</p>' })).toBeNull()
  })
})
