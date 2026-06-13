// ArtifactsPanelController lists every open editor's live artifacts and maps card interactions to the
// owning editor's own commands: selecting activates the decoration, Accept applies the rewrite, Dismiss
// removes the annotation. For a card whose file is not the active one, selecting asks the shell to open
// that file and then activates in its editor. Driven through real headless editors registered into
// ActiveEditorContext by path, with a stateful OpenFiles nav whose `open` flips the active file.

import { useEffect, useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { Button } from '@base-ui/react'
import type { Editor } from '@tiptap/core'
import { i18n } from '../../i18n'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { useActiveEditor } from '../../editor/ActiveEditorContext'
import { OpenFilesContext } from '../../editor/OpenFilesContext'
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
const PATH = '/test.md'

type Entries = readonly (readonly [string, Editor])[]

function RegisterEditors({ entries }: { readonly entries: Entries }): null {
  const { registerEditor, unregisterEditor } = useActiveEditor()
  useEffect(() => {
    entries.forEach(([path, editor]) => registerEditor(path, editor))
    return () => entries.forEach(([path]) => unregisterEditor(path))
  }, [entries, registerEditor, unregisterEditor])
  return null
}

function Shell({
  entries,
  onOpen
}: {
  readonly entries: Entries
  readonly onOpen?: (path: string) => void
}): React.JSX.Element {
  const [activePath, setActivePath] = useState(entries[0][0])
  const nav = useMemo(
    () => ({
      activePath,
      open: (path: string): void => {
        onOpen?.(path)
        setActivePath(path)
      },
      close: (): void => undefined
    }),
    [activePath, onOpen]
  )
  return (
    <I18nextProvider i18n={i18n}>
      <ActiveEditorProvider>
        <OpenFilesContext.Provider value={nav}>
          <RegisterEditors entries={entries} />
          {entries.map(([path]) => (
            <Button key={path} onClick={() => nav.open(path)}>{`open:${path}`}</Button>
          ))}
          <ArtifactsPanelController />
        </OpenFilesContext.Provider>
      </ActiveEditorProvider>
    </I18nextProvider>
  )
}

function renderPanel(entries: Entries, onOpen?: (path: string) => void): void {
  render(<Shell entries={entries} onOpen={onOpen} />)
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
      renderPanel([[PATH, editor]])
      expect(screen.getByText(/No artifacts yet/)).toBeInTheDocument()
    } finally {
      editor.destroy()
    }
  })

  it('renders a card per artifact and activates the one selected', () => {
    const editor = createTestEditor(CONTENT)
    try {
      renderPanel([[PATH, editor]])
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
      renderPanel([[PATH, editor]])
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
      renderPanel([[PATH, editor]])
      act(() => seed(editor))

      // Target the card by its composite key: once active, the proposal also renders its replacement as an
      // editor decoration, so the card text alone is ambiguous.
      const card = screen.getByTestId(`artifact-card:${PATH}::p_1`)
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
      renderPanel([[PATH, editor]])
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

describe('ArtifactsPanelController cross-file', () => {
  it('opens the file and activates in its editor when the card is for another file', () => {
    const a = createTestEditor(CONTENT)
    const b = createTestEditor(CONTENT)
    const onOpen = vi.fn()
    try {
      renderPanel(
        [
          ['/a.md', a],
          ['/b.md', b]
        ],
        onOpen
      )
      act(() => seed(b))

      fireEvent.click(screen.getByText('Soften the threat.'))

      expect(onOpen).toHaveBeenCalledWith('/b.md')
      expect(getActiveAnnotationId(b)).toBe('a_1')
      expect(getActiveAnnotationId(a)).toBeNull()
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  it('deactivates a file’s artifact when the user leaves it, so one click re-activates', () => {
    const [a, b] = ['/a.md', '/b.md'].map(() => createTestEditor(CONTENT))
    try {
      renderPanel([
        ['/a.md', a],
        ['/b.md', b]
      ])
      act(() => seed(a))
      fireEvent.click(screen.getByText('Soften the threat.'))

      // Leaving A for B clears A's active artifact; returning leaves it deactivated.
      fireEvent.click(screen.getByRole('button', { name: 'open:/b.md' }))
      expect(getActiveAnnotationId(a)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'open:/a.md' }))

      // So a single card click re-activates it (no stale-active double click).
      fireEvent.click(screen.getByText('Soften the threat.'))
      expect(getActiveAnnotationId(a)).toBe('a_1')
    } finally {
      ;[a, b].forEach((editor) => editor.destroy())
    }
  })
})
