// propose_edit: success creates a proposal over the resolved passage; absent text fails not_found,
// repeated text fails ambiguous, and overlapping proposals fail recoverably.

import { describe, expect, it } from 'vitest'
import { acceptProposal, getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { proposeEdit } from '../tool-propose-edit'

describe('proposeEdit', () => {
  it('creates a proposal over the resolved passage', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { passage: 'world', text: 'earth' })

      expect(result.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    })
  })

  it('applies a single-word replacement inline when accepted', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { passage: 'world', text: 'earth' })
      expect(result.ok).toBe(true)

      const id = getProposals(editor)[0]?.id
      if (!id) return expect.fail('expected a proposal')
      acceptProposal({ editor, id })

      expect(editor.state.doc.childCount).toBe(1)
      expect(editor.state.doc.textContent).toBe('hello earth')
    })
  })

  it('applies multi-paragraph markdown as separate paragraphs when accepted', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { passage: 'world', text: 'a\n\nb' })
      expect(result.ok).toBe(true)

      const id = getProposals(editor)[0]?.id
      if (!id) return expect.fail('expected a proposal')
      acceptProposal({ editor, id })

      expect(editor.state.doc.childCount).toBe(3)
      expect(editor.state.doc.child(0).textContent).toBe('hello ')
      expect(editor.state.doc.child(1).textContent).toBe('a')
      expect(editor.state.doc.child(2).textContent).toBe('b')
    })
  })

  it('fails not_found when the text is absent', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { passage: 'missing', text: 'x' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('fails ambiguous when the text occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = proposeEdit(editor, { passage: 'the', text: 'a' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })

  it('fails when proposals overlap', () => {
    withEditor('hello world', (editor) => {
      const first = proposeEdit(editor, { passage: 'hello world', text: 'a' })
      expect(first.ok).toBe(true)

      const second = proposeEdit(editor, { passage: 'world', text: 'b' })
      expect(second.ok).toBe(false)
    })
  })
})
