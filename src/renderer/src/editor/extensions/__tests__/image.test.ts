// Image node: markdown parses to an image node, and an inserted image round-trips back to markdown.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { withEditor } from './editor-test-harness'

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function imageNodes(editor: Editor): Node[] {
  const nodes: Node[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') nodes.push(node)
  })
  return nodes
}

describe('image extension', () => {
  it('parses a markdown image into an image node', () => {
    withEditor(`![a cat](${PNG_DATA_URL})`, (editor) => {
      const images = imageNodes(editor)
      expect(images).toHaveLength(1)
      expect(images[0].attrs.src).toBe(PNG_DATA_URL)
      expect(images[0].attrs.alt).toBe('a cat')
    })
  })

  it('round-trips an inserted base64 image back to markdown', () => {
    withEditor('', (editor) => {
      editor.commands.setImage({ src: PNG_DATA_URL, alt: 'a cat' })
      expect(editor.getMarkdown()).toContain(`![a cat](${PNG_DATA_URL})`)
    })
  })
})
