// FileHandler insertion: inserts an image node at the selection and at a given position, and inserts a
// url source synchronously (the pasted-gif path) without encoding.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { insertImageAt, insertImageSource } from '../file-handler'
import { createTestEditor, withEditor } from './editor-test-harness'

const URL_SRC = 'https://x.test/a.gif'

function imageSrcs(editor: Editor): string[] {
  const srcs: string[] = []
  editor.state.doc.descendants((node: Node) => {
    if (node.type.name === 'image') srcs.push(node.attrs.src)
  })
  return srcs
}

describe('insertImageAt', () => {
  it('inserts an image at the current selection when pos is null', () => {
    withEditor('hello', (editor) => {
      insertImageAt(editor, { src: URL_SRC, pos: null })
      expect(imageSrcs(editor)).toContain(URL_SRC)
    })
  })

  it('inserts an image at the given drop position', () => {
    withEditor('hello world', (editor) => {
      insertImageAt(editor, { src: URL_SRC, pos: 1 })
      expect(imageSrcs(editor)).toEqual([URL_SRC])
    })
  })
})

describe('insertImageSource', () => {
  it('inserts a url source synchronously without encoding (pasted gif)', () => {
    withEditor('', (editor) => {
      void insertImageSource(editor, { source: { kind: 'url', src: URL_SRC }, pos: null })
      expect(imageSrcs(editor)).toEqual([URL_SRC])
    })
  })

  it('encodes and inserts a file source as a data url', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const editor = createTestEditor('')
    try {
      await insertImageSource(editor, { source: { kind: 'file', file }, pos: null })
      expect(imageSrcs(editor).some((src) => src.startsWith('data:image/png'))).toBe(true)
    } finally {
      editor.destroy()
    }
  })
})
