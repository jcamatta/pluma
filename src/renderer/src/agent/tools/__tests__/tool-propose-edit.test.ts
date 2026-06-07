// propose_edit: success creates a proposal over a resolved range; missing range, drifted range, and
// overlapping proposals each fail recoverably.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { getProposals } from '../../../editor/extensions/proposals'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getRanges } from '../tool-get-ranges'
import { proposeEdit } from '../tool-propose-edit'
import { stringField } from './result-helpers'

function resolveRangeId(editor: Editor, text: string): string {
  return stringField(getRanges(editor, { text }), 'rangeId')
}

describe('proposeEdit', () => {
  it('creates a proposal for a resolved range', () => {
    withEditor('hello world', (editor) => {
      const rangeId = resolveRangeId(editor, 'world')
      const result = proposeEdit(editor, { rangeId, replacementText: 'earth' })

      expect(result.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    })
  })

  it('fails when the range id is unknown', () => {
    withEditor('hello world', (editor) => {
      const result = proposeEdit(editor, { rangeId: 'r_99', replacementText: 'x' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error).toContain('not found')
    })
  })

  it('fails when the range text has drifted', () => {
    withEditor('hello world', (editor) => {
      const rangeId = resolveRangeId(editor, 'world')
      // Mutate the document so the tracked range no longer matches its original text.
      editor.commands.setContent('hello there')

      const result = proposeEdit(editor, { rangeId, replacementText: 'earth' })
      expect(result.ok).toBe(false)
    })
  })

  it('fails when proposals overlap', () => {
    withEditor('hello world', (editor) => {
      const firstId = resolveRangeId(editor, 'hello world')
      const secondId = resolveRangeId(editor, 'world')

      const first = proposeEdit(editor, { rangeId: firstId, replacementText: 'a' })
      expect(first.ok).toBe(true)

      const second = proposeEdit(editor, { rangeId: secondId, replacementText: 'b' })
      expect(second.ok).toBe(false)
    })
  })
})
