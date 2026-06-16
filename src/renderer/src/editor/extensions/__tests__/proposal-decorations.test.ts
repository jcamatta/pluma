// The insert widget of an active proposal must keep its DOM node across unrelated transactions.
// A stable decoration key is what lets ProseMirror reuse the node; without it the widget remounts
// on every transaction (selection, typing) and replays its entry animation — the flicker we fix.

import { describe, expect, it } from 'vitest'
import { createProposal, setActiveProposal } from '../proposals'
import { withEditor } from './editor-test-harness'

describe('proposal insert widget', () => {
  it('reuses the same DOM node across an unrelated transaction', () => {
    withEditor('hello world', (editor) => {
      const from = editor.state.doc.textContent.indexOf('hello') + 1
      const created = createProposal({
        editor,
        proposal: {
          from,
          to: from + 'hello'.length,
          originalText: 'hello',
          replacementText: 'hello there',
          content: { type: 'doc', content: [] }
        }
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      setActiveProposal({ editor, id: created.proposal.id })
      const first = editor.view.dom.querySelector('.proposal-insert')
      expect(first).not.toBeNull()

      editor.view.dispatch(editor.state.tr.setMeta('unrelated', true))
      const second = editor.view.dom.querySelector('.proposal-insert')

      expect(second).toBe(first)
    })
  })
})
