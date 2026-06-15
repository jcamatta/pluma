// propose_edit: a replace stages a proposal over the resolved passage; an insert stages a zero-width
// proposal after the anchor, or at the document start when the anchor is omitted. Absent anchor fails
// not_found, repeated anchor fails ambiguous, a replace with no anchor fails anchor_required, and
// overlapping proposals fail recoverably.

import { describe, expect, it } from 'vitest'
import { acceptProposal, getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { proposeEdit } from '../tool-propose-edit'

describe('proposeEdit', () => {
  it('creates a proposal over the resolved passage and echoes the operation', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', anchor: 'world', text: 'earth' })

      expect(result.ok).toBe(true)
      if (!result.ok || result.output.type !== 'json') return expect.fail('expected json output')
      expect(result.output.value).toMatchObject({ status: 'proposed', operation: 'replace' })
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    })
  })

  it('inserts after the anchor as a zero-width proposal at the anchor end', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'insert', anchor: 'hello', text: ' there' })

      expect(result.ok).toBe(true)
      const proposal = getProposals(editor)[0]
      // "hello" ends at position 6 (1-based, after the doc node); the insert is a point there.
      expect(proposal?.from).toBe(6)
      expect(proposal?.to).toBe(6)
      expect(proposal?.originalText).toBe('')
      expect(proposal?.replacementText).toBe(' there')
    })
  })

  it('inserts at the document start when the anchor is omitted, resolving to position 1', () => {
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

  it('fails anchor_required when a replace has no anchor', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', text: 'x' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('anchor_required')).toBe(true)
    })
  })

  it('fails not_found when the anchor is absent', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', anchor: 'missing', text: 'x' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('not_found')).toBe(true)
    })
  })

  it('fails ambiguous when the anchor occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = proposeEdit(editor, { operation: 'replace', anchor: 'the', text: 'a' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })

  it('fails when proposals overlap', () => {
    withEditor('hello world', (editor) => {
      const first = proposeEdit(editor, { operation: 'replace', anchor: 'hello world', text: 'a' })
      expect(first.ok).toBe(true)

      const second = proposeEdit(editor, { operation: 'replace', anchor: 'world', text: 'b' })
      expect(second.ok).toBe(false)
    })
  })
})
