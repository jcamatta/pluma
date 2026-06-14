// get_current_selection: reports the selected text and the file path without touching editor state.

import { describe, expect, it } from 'vitest'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getCurrentSelection } from '../tool-get-current-selection'

describe('getCurrentSelection', () => {
  it('returns the selected text tagged with the file path', () => {
    withEditor('hello world', (editor) => {
      const start = editor.state.doc.textContent.indexOf('world') + 1
      editor.commands.setTextSelection({ from: start, to: start + 'world'.length })

      const result = getCurrentSelection({ editor, path: '/book/chapter.md' })

      expect(result).toEqual({
        ok: true,
        output: { type: 'json', value: { path: '/book/chapter.md', text: 'world' } }
      })
    })
  })

  it('returns empty text when there is no selection', () => {
    withEditor('hello world', (editor) => {
      editor.commands.setTextSelection(1)

      const result = getCurrentSelection({ editor, path: '/book/chapter.md' })

      expect(result).toEqual({
        ok: true,
        output: { type: 'json', value: { path: '/book/chapter.md', text: '' } }
      })
    })
  })
})
