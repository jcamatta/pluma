// useEditorPendingCounts maps each open editor to its pending-suggestion count for the tab badges,
// subscribing to every editor's transaction stream. The behaviour that matters for performance: a
// transaction that leaves the counts unchanged (plain typing) must return the SAME snapshot reference,
// so useSyncExternalStore does not re-render the tab strip on every keystroke. Driven through the real
// provider store and a headless editor.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { createAnnotation } from '../extensions/annotations'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { useEditorPendingCounts } from '../useEditorPendingCounts'

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
  readonly counts: ReturnType<typeof useEditorPendingCounts>
} {
  return { api: useActiveEditor(), counts: useEditorPendingCounts() }
}

describe('useEditorPendingCounts', () => {
  it('maps each open editor to its pending-suggestion count', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      act(() => result.current.api.store.mount('/a.md', editor))
      expect(result.current.counts.get('/a.md')).toBe(0)

      act(() => createAnnotation({ editor, annotation: ANNOTATION }))
      expect(result.current.counts.get('/a.md')).toBe(1)
    } finally {
      editor.destroy()
    }
  })

  it('keeps a stable snapshot identity across a transaction that leaves the counts unchanged', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      act(() => result.current.api.store.mount('/a.md', editor))
      const before = result.current.counts

      // A plain edit changes the editor state but not the pending count: the reference must hold.
      act(() => {
        editor.commands.insertContent('!')
      })
      expect(result.current.counts).toBe(before)
      expect(result.current.counts.get('/a.md')).toBe(0)

      // A new annotation does change the count, so a fresh snapshot is returned.
      act(() => createAnnotation({ editor, annotation: ANNOTATION }))
      expect(result.current.counts).not.toBe(before)
      expect(result.current.counts.get('/a.md')).toBe(1)
    } finally {
      editor.destroy()
    }
  })
})
