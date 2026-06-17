// useOpenArtifacts reflects every open file's editor: it folds each registered editor's annotation/proposal
// plugin state into one list, tags each artifact with its editor's path, and tracks which composite keys
// (`path::id`) are active — updating as the agent's commands mutate any editor. Driven through real headless
// editors registered into ActiveEditorContext by path.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { useActiveEditor } from '../../editor/ActiveEditorContext'
import { createAnnotation, setActiveAnnotation } from '../../editor/extensions/annotations'
import { createProposal } from '../../editor/extensions/proposals'
import { createTestEditor } from '../../editor/extensions/__tests__/editor-test-harness'
import { useOpenArtifacts } from '../useOpenArtifacts'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

const ANNOTATION = {
  from: 20,
  to: 25,
  label: 'Tense',
  description: 'Soften it',
  severity: 'warning' as const,
  quote: 'jumps'
}

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ActiveEditorProvider>{children}</ActiveEditorProvider>
}

function useHarness(): {
  readonly api: ReturnType<typeof useActiveEditor>
  readonly result: ReturnType<typeof useOpenArtifacts>
} {
  return { api: useActiveEditor(), result: useOpenArtifacts() }
}

describe('useOpenArtifacts', () => {
  it('is empty with no editors, then tags each artifact with its editor path in document order', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      expect(result.current.result.artifacts).toEqual([])

      act(() => result.current.api.store.mount('/a.md', editor))
      act(() => {
        createProposal({
          editor,
          proposal: {
            from: 2,
            to: 6,
            originalText: '',
            replacementText: 'A',
            content: { type: 'doc', content: [] }
          }
        })
        createAnnotation({ editor, annotation: ANNOTATION })
      })

      const seen = result.current.result.artifacts.map((a) => [a.path, a.id, a.kind])
      expect(seen).toEqual([
        ['/a.md', 'p_1', 'proposal'],
        ['/a.md', 'a_1', 'annotation']
      ])
    } finally {
      editor.destroy()
    }
  })

  it('aggregates across files and keys the active artifact by path', () => {
    const a = createTestEditor(CONTENT)
    const b = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      act(() => {
        result.current.api.store.mount('/a.md', a)
        result.current.api.store.mount('/b.md', b)
      })
      act(() => {
        createAnnotation({ editor: a, annotation: ANNOTATION })
        createAnnotation({ editor: b, annotation: ANNOTATION })
      })

      expect(result.current.result.artifacts.map((artifact) => artifact.path)).toEqual([
        '/a.md',
        '/b.md'
      ])

      act(() => setActiveAnnotation({ editor: b, id: 'a_1' }))
      expect(result.current.result.activeKeys.has('/b.md::a_1')).toBe(true)
      expect(result.current.result.activeKeys.has('/a.md::a_1')).toBe(false)
    } finally {
      a.destroy()
      b.destroy()
    }
  })
})
