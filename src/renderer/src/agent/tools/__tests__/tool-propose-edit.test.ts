// propose_edit: a replace stages a proposal over the resolved passage; an insert stages a zero-width
// proposal after its `after` passage, or at the document start when `after` is omitted. Absent text
// fails not_found, repeated text fails ambiguous, and overlapping proposals fail recoverably.

import { describe, expect, it } from 'vitest'
import { acceptProposal, getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { proposeEdit } from '../tool-propose-edit'

describe('proposeEdit', () => {
  it('creates a proposal over the resolved passage and echoes the operation', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', passage: 'world', text: 'earth' })

      expect(result.ok).toBe(true)
      if (!result.ok || result.output.type !== 'json') return expect.fail('expected json output')
      expect(result.output.value).toMatchObject({ status: 'proposed', operation: 'replace' })
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    })
  })

  it('inserts after its passage as a zero-width proposal at the passage end', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'insert', after: 'hello', text: ' there' })

      expect(result.ok).toBe(true)
      const proposal = getProposals(editor)[0]
      // "hello" ends at position 6 (1-based, after the doc node); the insert is a point there.
      expect(proposal?.from).toBe(6)
      expect(proposal?.to).toBe(6)
      expect(proposal?.originalText).toBe('')
      expect(proposal?.replacementText).toBe(' there')
    })
  })

  it('inserts at the document start when `after` is omitted, resolving to position 1', () => {
    withEditor('', (editor) => {
      const result = proposeEdit(editor, { operation: 'insert', text: 'first words' })

      expect(result.ok).toBe(true)
      const proposal = getProposals(editor)[0]
      expect(proposal?.from).toBe(1)
      expect(proposal?.to).toBe(1)
      expect(proposal?.originalText).toBe('')
    })
  })

  it('flattens an inserted multi-paragraph text into one block', () => {
    withEditor('', (editor) => {
      const result = proposeEdit(editor, {
        operation: 'insert',
        text: 'first paragraph\n\nsecond paragraph'
      })
      expect(result.ok).toBe(true)

      const proposal = getProposals(editor)[0]
      if (!proposal) return expect.fail('expected a proposal')
      acceptProposal({ editor, id: proposal.id })

      // insertText does not reconstruct paragraph nodes; the blank line collapses to a single block.
      expect(editor.state.doc.childCount).toBe(1)
    })
  })

  it('fails not_found when the passage is absent', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', passage: 'missing', text: 'x' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('not_found')).toBe(true)
    })
  })

  it('fails ambiguous when the passage occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', passage: 'the', text: 'a' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })

  it('fails when proposals overlap', () => {
    withEditor('hello world', (editor) => {
      const first = proposeEdit(editor, { operation: 'replace', passage: 'hello world', text: 'a' })
      expect(first.ok).toBe(true)

      const second = proposeEdit(editor, { operation: 'replace', passage: 'world', text: 'b' })
      expect(second.ok).toBe(false)
    })
  })
})
