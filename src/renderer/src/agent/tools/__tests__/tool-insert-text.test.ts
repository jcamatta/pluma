// insert_at / insert_after: each stages a zero-width content proposal that, on accept, lands the
// drafted markdown as real nodes. A start insert into an empty doc must yield exactly the drafted
// paragraphs (no stray empty block); insert_after must place the new block after the anchor's block,
// not split it. Absent / repeated anchors fail recoverably.

import type { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { acceptProposal, getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { insertAfter, insertAt } from '../tool-insert-text'

// Accept the proposal the handler created and return so callers can assert the resulting document.
function acceptStaged(editor: Editor): void {
  const id = getProposals(editor)[0]?.id
  if (!id) return expect.fail('expected a staged proposal')
  acceptProposal({ editor, id })
}

describe('insertAt start', () => {
  it('drafts paragraphs into an empty doc with no stray empty paragraph', () => {
    withEditor('', (editor) => {
      const result = insertAt(editor, { position: 'start', text: 'first\n\nsecond' })
      expect(result.ok).toBe(true)

      acceptStaged(editor)
      expect(editor.state.doc.childCount).toBe(2)
      expect(editor.state.doc.child(0).textContent).toBe('first')
      expect(editor.state.doc.child(1).textContent).toBe('second')
    })
  })

  it('prepends drafted blocks before existing content', () => {
    withEditor('original', (editor) => {
      const result = insertAt(editor, { position: 'start', text: 'intro' })
      expect(result.ok).toBe(true)

      acceptStaged(editor)
      expect(editor.state.doc.child(0).textContent).toBe('intro')
      expect(editor.state.doc.child(1).textContent).toBe('original')
    })
  })
})

describe('insertAt end', () => {
  it('appends drafted blocks after existing content', () => {
    withEditor('original', (editor) => {
      const result = insertAt(editor, { position: 'end', text: 'tail' })
      expect(result.ok).toBe(true)

      acceptStaged(editor)
      const last = editor.state.doc.childCount - 1
      expect(editor.state.doc.child(0).textContent).toBe('original')
      expect(editor.state.doc.child(last).textContent).toBe('tail')
    })
  })
})

describe('insertAfter', () => {
  it('places the new block after the anchor block, not splitting it', () => {
    withEditor('alpha\n\nbeta', (editor) => {
      const result = insertAfter(editor, { anchor: 'alpha', text: 'middle' })
      expect(result.ok).toBe(true)

      acceptStaged(editor)
      expect(editor.state.doc.childCount).toBe(3)
      expect(editor.state.doc.child(0).textContent).toBe('alpha')
      expect(editor.state.doc.child(1).textContent).toBe('middle')
      expect(editor.state.doc.child(2).textContent).toBe('beta')
    })
  })

  it('fails not_found when the anchor is absent', () => {
    withEditor('alpha', (editor) => {
      const result = insertAfter(editor, { anchor: 'missing', text: 'x' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('fails ambiguous when the anchor occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = insertAfter(editor, { anchor: 'the', text: 'x' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })
})
