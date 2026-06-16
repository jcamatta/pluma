// The proposal preview is block/span-level red-green: the new content renders as a formatted, green
// widget (a single widget at `proposal.to`, keyed on the proposal id so ProseMirror reuses its DOM
// node across unrelated transactions); a replace also strikes the removed span red.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { Decoration } from '@tiptap/pm/view'
import { proposalDecorations } from '../proposal-decorations'
import type { PillLabels } from '../proposal-decorations'
import type { Proposal } from '../proposals'
import { acceptProposal, createProposal, getProposals, setActiveProposal } from '../proposals'
import {
  getActiveSuggestionId,
  setActiveSuggestion,
  setSuggestionsVisible
} from '../suggestions-ui'
import { withEditor } from './editor-test-harness'

const labels: PillLabels = {
  rewrite: 'Rewrite',
  insert: 'Insert',
  accept: 'Accept',
  reject: 'Reject',
  conflicted: 'Conflicted'
}

const noopActions = {
  onAccept: () => {},
  onReject: () => {},
  onToggleActive: () => {}
}

function parse(
  editor: Editor,
  markdown: string
): ReturnType<NonNullable<Editor['markdown']>['parse']> {
  const manager = editor.markdown
  if (!manager) return expect.fail('markdown manager unavailable')
  return manager.parse(markdown)
}

function readyProposal(editor: Editor, span: { from: number; to: number }): Proposal {
  return {
    id: 'p_1',
    from: span.from,
    to: span.to,
    originalText: editor.state.doc.textBetween(span.from, span.to, '\n'),
    replacementText: '# Heading\n\nBody',
    content: parse(editor, '# Heading\n\nBody'),
    status: 'ready'
  }
}

// A widget decoration is the only one whose start and end coincide (it sits at a single position);
// the removed-span mark covers a real range.
function isWidget(decoration: Decoration): boolean {
  return decoration.from === decoration.to
}

function isRemovedSpan(decoration: Decoration): boolean {
  return !isWidget(decoration)
}

function inactiveDecorations(editor: Editor, proposal: Proposal): Decoration[] {
  return proposalDecorations({
    proposal,
    schema: editor.state.schema,
    active: false,
    labels,
    actions: noopActions
  })
}

// Creates a heading insert at the document end (without activating it) and returns its id. Both
// active-marker tests need the same draft, so the shared setup lives here.
function createDraftId(editor: Editor): string | null {
  const at = editor.state.doc.content.size
  const created = createProposal({
    editor,
    proposal: {
      from: at,
      to: at,
      originalText: '',
      replacementText: '# Heading\n\nBody',
      content: parse(editor, '# Heading\n\nBody')
    }
  })
  return created.ok ? created.proposal.id : null
}

describe('proposalDecorations', () => {
  it('yields only a green widget for a pure insert', () => {
    withEditor('hello world', (editor) => {
      const at = editor.state.doc.content.size
      const proposal = readyProposal(editor, { from: at, to: at })

      const decorations = inactiveDecorations(editor, proposal)

      expect(decorations).toHaveLength(1)
      expect(isWidget(decorations[0])).toBe(true)
    })
  })

  it('adds a removed-span mark for a replace', () => {
    withEditor('hello world', (editor) => {
      const from = editor.state.doc.textContent.indexOf('hello') + 1
      const proposal = readyProposal(editor, { from, to: from + 'hello'.length })

      const decorations = inactiveDecorations(editor, proposal)

      expect(decorations).toHaveLength(2)
      expect(decorations.filter(isWidget)).toHaveLength(1)
      const removed = decorations.find(isRemovedSpan)
      expect(removed?.from).toBe(from)
      expect(removed?.to).toBe(from + 'hello'.length)
    })
  })

  it('keeps the conflicted mark when the proposal drifted', () => {
    withEditor('hello world', (editor) => {
      const from = editor.state.doc.textContent.indexOf('hello') + 1
      const proposal: Proposal = {
        ...readyProposal(editor, { from, to: from + 'hello'.length }),
        status: 'conflicted'
      }

      const decorations = inactiveDecorations(editor, proposal)

      expect(decorations).toHaveLength(1)
      expect(isWidget(decorations[0])).toBe(false)
    })
  })

  it('tags the active proposal preview with the active marker class through the plugin', () => {
    withEditor('hello world', (editor) => {
      const id = createDraftId(editor)
      if (id === null) return expect.fail('proposal not created')

      expect(editor.view.dom.querySelector('.proposal-active')).toBeNull()

      setActiveProposal({ editor, id })
      expect(editor.view.dom.querySelector('.proposal-draft.proposal-active')).not.toBeNull()

      setActiveProposal({ editor, id: null })
      expect(editor.view.dom.querySelector('.proposal-active')).toBeNull()
    })
  })

  it('renders the active proposal content as formatted DOM, reused across transactions', () => {
    withEditor('hello world', (editor) => {
      const id = createDraftId(editor)
      if (id === null) return expect.fail('proposal not created')

      setActiveProposal({ editor, id })
      const first = editor.view.dom.querySelector('.proposal-draft')
      expect(first?.querySelector('h1')).not.toBeNull()

      editor.view.dispatch(editor.state.tr.setMeta('unrelated', true))
      expect(editor.view.dom.querySelector('.proposal-draft')).toBe(first)
    })
  })
})

// Replaces `hello` with a one-word rewrite and returns the proposal id, without activating it.
function createRewriteId(editor: Editor): string | null {
  const from = editor.state.doc.textContent.indexOf('hello') + 1
  const created = createProposal({
    editor,
    proposal: {
      from,
      to: from + 'hello'.length,
      originalText: 'hello',
      replacementText: 'hi',
      content: parse(editor, 'hi')
    }
  })
  return created.ok ? created.proposal.id : null
}

describe('proposal accept/reject pill', () => {
  it('shows the pill only for the active proposal', () => {
    withEditor('hello world', (editor) => {
      const id = createRewriteId(editor)
      if (id === null) return expect.fail('proposal not created')

      expect(editor.view.dom.querySelector('.suggestion-pill')).toBeNull()

      setActiveProposal({ editor, id })
      expect(editor.view.dom.querySelectorAll('.suggestion-pill')).toHaveLength(1)
      // A rewrite's pill floats in the doc flow, not embedded in a draft overlay (that's insert-only).
      expect(editor.view.dom.querySelector('.suggestion-pill-overlay')).toBeNull()

      setActiveProposal({ editor, id: null })
      expect(editor.view.dom.querySelector('.suggestion-pill')).toBeNull()
    })
  })

  it('hides the pill when suggestions are hidden even while one is active', () => {
    withEditor('hello world', (editor) => {
      const id = createRewriteId(editor)
      if (id === null) return expect.fail('proposal not created')

      setActiveProposal({ editor, id })
      setSuggestionsVisible({ editor, visible: false })
      expect(editor.view.dom.querySelector('.suggestion-pill')).toBeNull()
    })
  })

  it('embeds the active insert pill inside the draft block as an overlay', () => {
    withEditor('hello world', (editor) => {
      const id = createDraftId(editor)
      if (id === null) return expect.fail('insert not created')
      setActiveProposal({ editor, id })

      // The pill rides inside the green block (an absolute overlay) so it adds no flow height — unlike a
      // rewrite, whose pill floats over the struck span. The block reserves headroom for it at all times.
      expect(
        editor.view.dom.querySelector('.proposal-draft.proposal-insert .suggestion-pill-overlay')
      ).not.toBeNull()
    })
  })

  it('labels a replace Rewrite and a pure insert Insert', () => {
    withEditor('hello world', (editor) => {
      const rewriteId = createRewriteId(editor)
      if (rewriteId === null) return expect.fail('rewrite not created')
      setActiveProposal({ editor, id: rewriteId })
      expect(editor.view.dom.querySelector('.suggestion-pill-label')?.textContent).toBe('Rewrite')
    })

    withEditor('hello world', (editor) => {
      const insertId = createDraftId(editor)
      if (insertId === null) return expect.fail('insert not created')
      setActiveProposal({ editor, id: insertId })
      expect(editor.view.dom.querySelector('.suggestion-pill-label')?.textContent).toBe('Insert')
    })
  })
})

describe('proposal accept/reject pill actions', () => {
  it('accepts on the accept button and removes the proposal', () => {
    withEditor('hello world', (editor) => {
      const id = createRewriteId(editor)
      if (id === null) return expect.fail('proposal not created')
      setActiveProposal({ editor, id })

      const accept = editor.view.dom.querySelector('.suggestion-pill-accept')
      accept?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

      expect(editor.state.doc.textContent).toBe('hi world')
      expect(getProposals(editor)).toHaveLength(0)
    })
  })

  it('rejects on the reject button and removes the proposal without applying', () => {
    withEditor('hello world', (editor) => {
      const id = createRewriteId(editor)
      if (id === null) return expect.fail('proposal not created')
      setActiveProposal({ editor, id })

      const reject = editor.view.dom.querySelector('.suggestion-pill-reject')
      reject?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

      expect(editor.state.doc.textContent).toBe('hello world')
      expect(getProposals(editor)).toHaveLength(0)
    })
  })

  it('toggles activation when the green preview is clicked', () => {
    withEditor('hello world', (editor) => {
      const id = createDraftId(editor)
      if (id === null) return expect.fail('proposal not created')

      const draft = editor.view.dom.querySelector('.proposal-draft')
      draft?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(getActiveSuggestionId(editor)).toBe(id)

      editor.view.dom
        .querySelector('.proposal-draft')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(getActiveSuggestionId(editor)).toBeNull()
    })
  })

  it('renders a conflicted proposal as a muted pill with no accept button', () => {
    withEditor('hello world', (editor) => {
      const id = createRewriteId(editor)
      if (id === null) return expect.fail('proposal not created')

      // Drift the underlying text, then attempt accept so the plugin flags the proposal conflicted.
      editor.commands.insertContentAt(2, 'Z')
      acceptProposal({ editor, id })
      expect(getProposals(editor)[0]?.status).toBe('conflicted')

      setActiveSuggestion({ editor, id })
      expect(editor.view.dom.querySelector('.suggestion-pill.conflicted')).not.toBeNull()
      expect(editor.view.dom.querySelector('.suggestion-pill-accept')).toBeNull()
      expect(editor.view.dom.querySelector('.suggestion-pill-label')?.textContent).toBe(
        'Conflicted'
      )
    })
  })
})
