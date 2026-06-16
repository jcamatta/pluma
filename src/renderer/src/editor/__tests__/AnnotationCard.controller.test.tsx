// AnnotationCardController derives the floating card from the editor's active-annotation plugin state:
// activating an annotation opens the card with that note; Escape and an outside mousedown clear the active
// suggestion (closing it); Got it marks the note read and closes. Driven through a real headless editor so
// the plugin state and coordsAtPos behave as in the app.

import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { i18n } from '../../i18n'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import {
  createAnnotation,
  getActiveAnnotationId,
  getAnnotations,
  setActiveAnnotation
} from '../extensions/annotations'
import { AnnotationCardController } from '../AnnotationCard.controller'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

function renderController(editor: Editor): void {
  render(
    <I18nextProvider i18n={i18n}>
      <AnnotationCardController editor={editor} />
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

describe('AnnotationCardController', () => {
  it('opens the card with the active annotation', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      expect(screen.queryByTestId('annotation-card')).not.toBeInTheDocument()

      act(() => setActiveAnnotation({ editor, id: 'a_1' }))
      expect(screen.getByTestId('annotation-card')).toBeInTheDocument()
      expect(screen.getByText('Tension')).toBeInTheDocument()
      // The warning severity is named in the header so the hue is not the only cue.
      expect(screen.getByText('Caution')).toBeInTheDocument()
      expect(screen.getByText('Soften the threat.')).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('closes on Escape, clearing the active suggestion', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      act(() => setActiveAnnotation({ editor, id: 'a_1' }))
      expect(screen.getByTestId('annotation-card')).toBeInTheDocument()

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })
      expect(getActiveAnnotationId(editor)).toBeNull()
      expect(screen.queryByTestId('annotation-card')).not.toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('closes on an outside mousedown', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      act(() => setActiveAnnotation({ editor, id: 'a_1' }))
      expect(screen.getByTestId('annotation-card')).toBeInTheDocument()

      act(() => {
        fireEvent.mouseDown(document.body)
      })
      expect(getActiveAnnotationId(editor)).toBeNull()
      expect(screen.queryByTestId('annotation-card')).not.toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('marks the note read on Got it and closes', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderController(editor)
      act(() => seed(editor))
      act(() => setActiveAnnotation({ editor, id: 'a_1' }))

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
      })

      expect(getAnnotations(editor)[0]?.status).toBe('read')
      expect(getActiveAnnotationId(editor)).toBeNull()
      expect(screen.queryByTestId('annotation-card')).not.toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })
})
