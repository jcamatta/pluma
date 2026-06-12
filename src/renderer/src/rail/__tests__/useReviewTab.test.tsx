// useReviewTab owns the Chat/Review tab and reports the live artifact count for the Review badge. It
// starts on the chat tab, switches on setTab, and reflects the active editor's annotations/proposals as
// they are created. Driven through a real headless editor registered into ActiveEditorContext.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { useActiveEditor } from '../../editor/ActiveEditorContext'
import { createAnnotation } from '../../editor/extensions/annotations'
import { createProposal } from '../../editor/extensions/proposals'
import { createTestEditor } from '../../editor/extensions/__tests__/editor-test-harness'
import { useReviewTab } from '../useReviewTab'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ActiveEditorProvider>{children}</ActiveEditorProvider>
}

function useHarness(): {
  readonly register: (editor: ReturnType<typeof createTestEditor> | null) => void
  readonly review: ReturnType<typeof useReviewTab>
} {
  const { register } = useActiveEditor()
  const review = useReviewTab()
  return { register, review }
}

describe('useReviewTab', () => {
  it('starts on the chat tab and switches to review', () => {
    const { result } = renderHook(useHarness, { wrapper })
    expect(result.current.review.tab).toBe('chat')

    act(() => result.current.review.setTab('review'))
    expect(result.current.review.tab).toBe('review')
  })

  it('counts the live artifacts for the Review badge', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(useHarness, { wrapper })
      expect(result.current.review.reviewCount).toBe(0)

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

      expect(result.current.review.reviewCount).toBe(2)
    } finally {
      editor.destroy()
    }
  })
})
