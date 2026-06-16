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
import type { CreateProposalInput } from '../proposals'
import { withEditor } from './editor-test-harness'

function spanOf(editor: Editor, text: string): { from: number; to: number } {
  const start = editor.state.doc.textContent.indexOf(text)
  const from = start + 1
  return { from, to: from + text.length }
}

function parse(
  editor: Editor,
  markdown: string
): ReturnType<NonNullable<Editor['markdown']>['parse']> {
  const manager = editor.markdown
  if (!manager) return expect.fail('markdown manager unavailable')
  return manager.parse(markdown)
}

// Build a createProposal input that replaces `original`'s span with `markdown`, parsing the content
// the same way the real tool does so accept applies real nodes.
function replacement(
  editor: Editor,
  edit: { original: string; markdown: string }
): CreateProposalInput['proposal'] {
  return {
    ...spanOf(editor, edit.original),
    originalText: edit.original,
    replacementText: edit.markdown,
    content: parse(editor, edit.markdown)
  }
}

describe('proposals extension', () => {
  it('mints sequential ids', () => {
    withEditor('hello world', (editor) => {
      const first = createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: 'hi' })
      })
      const second = createProposal({
        editor,
        proposal: replacement(editor, { original: 'world', markdown: 'earth' })
      })

      expect(first.ok && first.proposal.id).toBe('p_1')
      expect(second.ok && second.proposal.id).toBe('p_2')
    })
  })

  it('rejects an overlapping proposal', () => {
    withEditor('hello world', (editor) => {
      createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: 'hi' })
      })
      const overlap = createProposal({
        editor,
        proposal: {
          from: 2,
          to: 4,
          originalText: 'el',
          replacementText: 'XX',
          content: parse(editor, 'XX')
        }
      })

      expect(overlap.ok).toBe(false)
    })
  })

  it('applies the replacement text when accepted', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: 'hi' })
      })
      expect(created.ok).toBe(true)
      if (!created.ok) return

      acceptProposal({ editor, id: created.proposal.id })

      expect(editor.state.doc.textContent).toBe('hi world')
      // A single inline replacement stays in the original paragraph (no spurious block split).
      expect(editor.state.doc.childCount).toBe(1)
      expect(getProposals(editor)).toHaveLength(0)
    })
  })
})

describe('proposals extension conflict and lifecycle', () => {
  it('marks the proposal conflicted when the underlying text drifted', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: 'hi' })
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
        proposal: replacement(editor, { original: 'hello', markdown: 'hi' })
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

describe('proposals extension applies content as real nodes', () => {
  it('applies multi-paragraph content as separate paragraph nodes', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: 'first\n\nsecond' })
      })
      if (!created.ok) return

      acceptProposal({ editor, id: created.proposal.id })

      expect(getProposals(editor)).toHaveLength(0)
      // Replacing a span at the block start with two paragraphs lands as two new paragraph blocks,
      // pushing the surviving tail (" world") into its own following paragraph.
      expect(editor.state.doc.childCount).toBe(3)
      expect(editor.state.doc.child(0).type.name).toBe('paragraph')
      expect(editor.state.doc.child(0).textContent).toBe('first')
      expect(editor.state.doc.child(1).textContent).toBe('second')
      expect(editor.state.doc.child(2).textContent).toBe(' world')
    })
  })

  it('applies a heading as a real heading node, not literal markdown', () => {
    withEditor('hello world', (editor) => {
      const created = createProposal({
        editor,
        proposal: replacement(editor, { original: 'hello', markdown: '# H' })
      })
      if (!created.ok) return

      acceptProposal({ editor, id: created.proposal.id })

      expect(editor.state.doc.child(0).type.name).toBe('heading')
      expect(editor.state.doc.child(0).textContent).toBe('H')
    })
  })
})
