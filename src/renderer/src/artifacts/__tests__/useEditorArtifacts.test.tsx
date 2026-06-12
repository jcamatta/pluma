// useEditorArtifacts reflects the live editor: it folds the annotation/proposal plugin state into the
// ordered artifact list and tracks which ids are active, updating as the agent's commands mutate the
// editor. Driven through a real headless editor registered into ActiveEditorContext.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { useActiveEditor } from '../../editor/ActiveEditorContext'
import {
  createAnnotation,
  delAnnotation,
  setActiveAnnotation
} from '../../editor/extensions/annotations'
import { createProposal } from '../../editor/extensions/proposals'
import { createTestEditor } from '../../editor/extensions/__tests__/editor-test-harness'
import { useEditorArtifacts } from '../useEditorArtifacts'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ActiveEditorProvider>{children}</ActiveEditorProvider>
}

function useHarness(): {
  readonly register: (editor: ReturnType<typeof createTestEditor> | null) => void
  readonly result: ReturnType<typeof useEditorArtifacts>
} {
  const { register } = useActiveEditor()
  const result = useEditorArtifacts()
  return { register, result }
}

describe('useEditorArtifacts', () => {
  it('is empty with no editor, then reflects created artifacts in document order', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      expect(result.current.result.artifacts).toEqual([])

      act(() => result.current.register(editor))
      act(() => {
        createProposal({
          editor,
          proposal: { from: 2, to: 6, originalText: '', replacementText: 'A' }
        })
        createAnnotation({
          editor,
          annotation: {
            from: 20,
            to: 25,
            label: 'Tense',
            description: 'Soften it',
            severity: 'warning',
            quote: 'jumps'
          }
        })
      })

      expect(result.current.result.artifacts.map((a) => a.id)).toEqual(['p_1', 'a_1'])
      expect(result.current.result.artifacts.map((a) => a.kind)).toEqual(['proposal', 'annotation'])
    } finally {
      editor.destroy()
    }
  })

  it('tracks the active id and drops a removed annotation', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      act(() => result.current.register(editor))
      act(() => {
        createAnnotation({
          editor,
          annotation: {
            from: 20,
            to: 25,
            label: 'Tense',
            description: 'Soften it',
            severity: 'warning',
            quote: 'jumps'
          }
        })
      })

      expect(result.current.result.activeIds.has('a_1')).toBe(false)

      act(() => setActiveAnnotation({ editor, id: 'a_1' }))
      expect(result.current.result.activeIds.has('a_1')).toBe(true)

      act(() => delAnnotation({ editor, id: 'a_1' }))
      expect(result.current.result.artifacts).toEqual([])
    } finally {
      editor.destroy()
    }
  })
})
