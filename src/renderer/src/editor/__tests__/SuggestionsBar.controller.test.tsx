// SuggestionsBarController derives the sub-topbar from one editor's plugin state: it renders nothing while
// the file has no suggestions, appears once an annotation/proposal exists (even after all are reviewed), and
// its Hide all / Show all toggle flips the suggestions-ui `visible` flag and the toggle label. Driven
// through a real headless editor so the plugin state behaves as in the app.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { i18n } from '../../i18n'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { createAnnotation, getAnnotations } from '../extensions/annotations'
import { createProposal, getProposals } from '../extensions/proposals'
import {
  getActiveSuggestionId,
  getSuggestionsVisible,
  setSuggestionsVisible
} from '../extensions/suggestions-ui'
import { SuggestionsBarController } from '../SuggestionsBar.controller'

afterEach(() => {
  vi.restoreAllMocks()
})

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

function renderController(editor: Editor): void {
  render(
    <I18nextProvider i18n={i18n}>
      <SuggestionsBarController editor={editor} />
    </I18nextProvider>
  )
}

function seed(editor: Editor): void {
  createAnnotation({
    editor,
    annotation: {
      from: 11,
      to: 16,
      label: 'Tension',
      description: 'Soften the threat.',
      severity: 'warning',
      quote: 'brown'
    }
  })
}

function spanOf(editor: Editor, text: string): { from: number; to: number } {
  const from = editor.state.doc.textContent.indexOf(text) + 1
  return { from, to: from + text.length }
}

// A rewrite whose parsed content lets acceptProposal apply real nodes over `original`'s span.
function seedReplacement(
  editor: Editor,
  edit: { readonly original: string; readonly markdown: string }
): string {
  const span = spanOf(editor, edit.original)
  const manager = editor.markdown
  const content = manager ? manager.parse(edit.markdown) : { type: 'doc', content: [] }
  const result = createProposal({
    editor,
    proposal: {
      ...span,
      originalText: edit.original,
      replacementText: edit.markdown,
      content
    }
  })
  return result.ok ? result.proposal.id : ''
}

function seedNote(editor: Editor, quote: string): string {
  return createAnnotation({
    editor,
    annotation: {
      ...spanOf(editor, quote),
      label: 'note',
      description: 'note body',
      severity: 'warning',
      quote
    }
  }).id
}

describe('SuggestionsBarController', () => {
  it('renders nothing while the file has no suggestions', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      expect(screen.queryByText('Suggestions')).not.toBeInTheDocument()
      expect(screen.queryByText('All reviewed')).not.toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('appears once the file has a suggestion', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      expect(screen.getByText('Suggestions')).toBeInTheDocument()
      expect(screen.getByText(/1 to review/)).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('flips the visibility flag and the toggle label on Hide all', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      expect(getSuggestionsVisible(editor)).toBe(true)
      expect(screen.getByRole('button', { name: 'Hide all' })).toBeInTheDocument()

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Hide all' }))
      })

      expect(getSuggestionsVisible(editor)).toBe(false)
      expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })
})

describe('SuggestionsBarController list popover', () => {
  it('opens the grouped list popover from the List button', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => {
        seedReplacement(editor, { original: 'quick', markdown: 'swift' })
      })
      expect(screen.queryByText('Rewrites')).not.toBeInTheDocument()

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'List' }))
      })

      expect(screen.getByText('Rewrites')).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('jumps a row: forces visible, sets it active, and scrolls it into the center', () => {
    const editor = createTestEditor(CONTENT)
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    try {
      renderController(editor)
      act(() => {
        seedReplacement(editor, { original: 'quick', markdown: 'swift' })
        setSuggestionsVisible({ editor, visible: false })
      })
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'List' }))
      })

      act(() => {
        fireEvent.click(screen.getByText('swift'))
      })

      expect(getSuggestionsVisible(editor)).toBe(true)
      expect(getActiveSuggestionId(editor)).toBe('p_1')
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    } finally {
      editor.destroy()
    }
  })
})

function openList(editor: Editor): void {
  renderController(editor)
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
  })
}

describe('SuggestionsBarController list single-row actions', () => {
  it('accepts a single edit row from its Accept button', () => {
    const editor = createTestEditor(CONTENT)
    try {
      act(() => {
        seedReplacement(editor, { original: 'quick', markdown: 'swift' })
      })
      openList(editor)

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      })

      expect(getProposals(editor)).toHaveLength(0)
      expect(editor.state.doc.textContent).toContain('swift')
    } finally {
      editor.destroy()
    }
  })

  it('rejects a single edit row from its Reject button', () => {
    const editor = createTestEditor(CONTENT)
    try {
      act(() => {
        seedReplacement(editor, { original: 'quick', markdown: 'swift' })
      })
      openList(editor)

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
      })

      expect(getProposals(editor)).toHaveLength(0)
      expect(editor.state.doc.textContent).toContain('quick')
    } finally {
      editor.destroy()
    }
  })

  it('marks a single note read from its Mark read button', () => {
    const editor = createTestEditor(CONTENT)
    try {
      act(() => {
        seedNote(editor, 'quick')
      })
      openList(editor)

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Mark read' }))
      })

      expect(getAnnotations(editor)[0]?.status).toBe('read')
    } finally {
      editor.destroy()
    }
  })
})
