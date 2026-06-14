// propose_edit: success creates a proposal over the resolved passage; absent text fails not_found,
// repeated text fails ambiguous, and overlapping proposals fail recoverably.

import { describe, expect, it } from 'vitest'
import { getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { proposeEdit } from '../tool-propose-edit'

describe('proposeEdit', () => {
  it('creates a proposal over the resolved passage', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { text: 'world', replacementText: 'earth' })

      expect(result.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    })
  })

  it('fails not_found when the text is absent', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { text: 'missing', replacementText: 'x' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('fails ambiguous when the text occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = proposeEdit(editor, { text: 'the', replacementText: 'a' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })

  it('fails when proposals overlap', () => {
    withEditor('hello world', (editor) => {
      const first = proposeEdit(editor, { text: 'hello world', replacementText: 'a' })
      expect(first.ok).toBe(true)

      const second = proposeEdit(editor, { text: 'world', replacementText: 'b' })
      expect(second.ok).toBe(false)
    })
  })
})
