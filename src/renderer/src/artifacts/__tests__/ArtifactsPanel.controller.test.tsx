// ArtifactsPanelController lists the editor's live artifacts and maps card interactions to the editor's
// own commands: selecting activates the decoration, Accept applies the rewrite, Dismiss removes the
// annotation. Driven through a real headless editor registered into ActiveEditorContext.

import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { i18n } from '../../i18n'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { useActiveEditor } from '../../editor/ActiveEditorContext'
import {
  createAnnotation,
  getActiveAnnotationId,
  getAnnotations
} from '../../editor/extensions/annotations'
import {
  createProposal,
  getActiveProposalId,
  getProposals
} from '../../editor/extensions/proposals'
import { createTestEditor } from '../../editor/extensions/__tests__/editor-test-harness'
import { ArtifactsPanelController } from '../ArtifactsPanel.controller'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

function RegisterEditor({ editor }: { readonly editor: Editor }): null {
  const { register } = useActiveEditor()
  useEffect(() => {
    register(editor)
    return () => register(null)
  }, [editor, register])
  return null
}

function renderPanel(editor: Editor): void {
  render(
    <I18nextProvider i18n={i18n}>
      <ActiveEditorProvider>
        <RegisterEditor editor={editor} />
        <ArtifactsPanelController />
      </ActiveEditorProvider>
    </I18nextProvider>
  )
}

function seed(editor: Editor): void {
  const original = editor.state.doc.textBetween(1, 4)
  createProposal({
    editor,
    proposal: { from: 1, to: 4, originalText: original, replacementText: 'ZZZ' }
  })
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

describe('ArtifactsPanelController', () => {
  it('shows the empty state with no artifacts', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel(editor)
      expect(screen.getByText(/No artifacts yet/)).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('renders a card per artifact and activates the one selected', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel(editor)
      act(() => seed(editor))

      expect(screen.getByText('Soften the threat.')).toBeInTheDocument()
      expect(screen.getByText('ZZZ')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Soften the threat.'))
      expect(getActiveAnnotationId(editor)).toBe('a_1')
    } finally {
      editor.destroy()
    }
  })

  it('keeps only one artifact active across kinds', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel(editor)
      act(() => seed(editor))

      fireEvent.click(screen.getByText('Soften the threat.'))
      expect(getActiveAnnotationId(editor)).toBe('a_1')
      expect(getActiveProposalId(editor)).toBeNull()

      // Selecting the proposal clears the active annotation — never two active at once.
      fireEvent.click(screen.getByText('ZZZ'))
      expect(getActiveProposalId(editor)).toBe('p_1')
      expect(getActiveAnnotationId(editor)).toBeNull()
    } finally {
      editor.destroy()
    }
  })

  it('toggles the active card off when it is reclicked', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel(editor)
      act(() => seed(editor))

      // Target the card by id: once active, the proposal also renders its replacement as an editor
      // decoration, so the card text alone is ambiguous.
      const card = screen.getByTestId('artifact-card:p_1')
      fireEvent.click(card)
      expect(getActiveProposalId(editor)).toBe('p_1')

      fireEvent.click(card)
      expect(getActiveProposalId(editor)).toBeNull()
    } finally {
      editor.destroy()
    }
  })

  it('applies a proposal on Accept and removes an annotation on Dismiss', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel(editor)
      act(() => seed(editor))

      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      expect(getProposals(editor)).toHaveLength(0)
      expect(editor.getText()).toContain('ZZZ')

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(getAnnotations(editor)).toHaveLength(0)
    } finally {
      editor.destroy()
    }
  })
})
