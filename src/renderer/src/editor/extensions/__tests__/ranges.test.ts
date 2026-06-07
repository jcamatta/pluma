// Range tracking: sequential ids minted in plugin state, drift detection, and removal.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { delRange, getRange, setRange } from '../ranges'
import { withEditor } from './editor-test-harness'

function spanOf(editor: Editor, text: string): { from: number; to: number } {
  const start = editor.state.doc.textContent.indexOf(text)
  const from = start + 1
  return { from, to: from + text.length }
}

describe('ranges extension', () => {
  it('mints sequential ids in plugin state', () => {
    withEditor('hello world', (editor) => {
      const first = setRange({
        editor,
        range: { ...spanOf(editor, 'hello'), originalText: 'hello' }
      })
      const second = setRange({
        editor,
        range: { ...spanOf(editor, 'world'), originalText: 'world' }
      })

      expect(first.id).toBe('r_1')
      expect(second.id).toBe('r_2')
    })
  })

  it('reports ok status when the text matches', () => {
    withEditor('hello world', (editor) => {
      const range = setRange({
        editor,
        range: { ...spanOf(editor, 'hello'), originalText: 'hello' }
      })

      expect(range.status).toBe('ok')
      expect(range.error).toBeNull()
      expect(range.currentText).toBe('hello')
    })
  })

  it('reports error status after the underlying text drifts', () => {
    withEditor('hello world', (editor) => {
      const range = setRange({
        editor,
        range: { ...spanOf(editor, 'hello'), originalText: 'hello' }
      })

      editor.commands.insertContentAt(range.from + 1, 'X')
      const drifted = getRange({ editor, id: range.id })

      expect(drifted?.status).toBe('error')
      expect(drifted?.error).toContain('no longer matches')
    })
  })

  it('removes a range by id', () => {
    withEditor('hello world', (editor) => {
      const range = setRange({
        editor,
        range: { ...spanOf(editor, 'hello'), originalText: 'hello' }
      })

      delRange({ editor, id: range.id })

      expect(getRange({ editor, id: range.id })).toBeNull()
    })
  })

  it('deduplicates identical range content', () => {
    withEditor('hello world', (editor) => {
      const span = { ...spanOf(editor, 'hello'), originalText: 'hello' }
      setRange({ editor, range: span })
      const second = setRange({ editor, range: span })

      expect(getRange({ editor, id: second.id })).not.toBeNull()
      expect(getRange({ editor, id: 'r_1' })).toBeNull()
    })
  })
})
