// Proposal tracking: sequential ids, overlap rejection, accept (apply) and conflict on drift.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import {
  acceptProposal,
  createProposal,
  getActiveProposalId,
  getProposals,
  rejectProposal,
  setActiveProposal
} from '../proposals'
import { withEditor } from './editor-test-harness'

function spanOf(editor: Editor, text: string): { from: number; to: number } {
  const start = editor.state.doc.textContent.indexOf(text)
  const from = start + 1
  return { from, to: from + text.length }
}

describe('proposals extension', () => {
  it('mints sequential ids', () => {
    withEditor('hello world', (editor) => {
      const first = createProposal({
        editor,
        proposal: { ...spanOf(editor, 'hello'), originalText: 'hello', replacementText: 'hi' }
      })
      const second = createProposal({
        editor,
        proposal: { ...spanOf(editor, 'world'), originalText: 'world', replacementText: 'earth' }
      })

      expect(first.ok && first.proposal.id).toBe('p_1')
      expect(second.ok && second.proposal.id).toBe('p_2')
    })
  })

  it('rejects an overlapping proposal', () => {
    withEditor('hello world', (editor) => {
      createProposal({
        editor,
        proposal: { ...spanOf(editor, 'hello'), originalText: 'hello', replacementText: 'hi' }
      })
      const overlap = createProposal({
        editor,
        proposal: { from: 2, to: 4, originalText: 'el', replacementText: 'XX' }
      })

      expect(overlap.ok).toBe(false)
    })
  })

  it('applies the replacement text when accepted', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: { ...spanOf(editor, 'hello'), originalText: 'hello', replacementText: 'hi' }
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      acceptProposal({ editor, id: created.proposal.id })

      expect(editor.state.doc.textContent).toBe('hi world')
      expect(getProposals(editor)).toHaveLength(0)
    })
  })

  it('marks the proposal conflicted when the underlying text drifted', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: { ...spanOf(editor, 'hello'), originalText: 'hello', replacementText: 'hi' }
      })
      if (!created.ok) return

      editor.commands.insertContentAt(created.proposal.from + 1, 'Z')
      acceptProposal({ editor, id: created.proposal.id })

      expect(getProposals(editor)[0]?.status).toBe('conflicted')
      expect(editor.state.doc.textContent).not.toBe('hi world')
    })
  })

  it('removes a rejected proposal and toggles active state', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: { ...spanOf(editor, 'hello'), originalText: 'hello', replacementText: 'hi' }
      })
      if (!created.ok) return

      setActiveProposal({ editor, id: created.proposal.id })
      expect(getActiveProposalId(editor)).toBe(created.proposal.id)

      rejectProposal({ editor, id: created.proposal.id })
      expect(getProposals(editor)).toHaveLength(0)
      expect(getActiveProposalId(editor)).toBeNull()
    })
  })
})
