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
import { createAnnotation } from '../extensions/annotations'
import { createProposal } from '../extensions/proposals'
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

function seedRewrite(editor: Editor): void {
  createProposal({
    editor,
    proposal: {
      from: 5,
      to: 10,
      originalText: editor.state.doc.textBetween(5, 10, '\n'),
      replacementText: 'swift',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
    }
  })
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
      act(() => seedRewrite(editor))
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
        seedRewrite(editor)
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
