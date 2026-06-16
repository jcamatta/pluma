// useEditorSuggestions reflects a single editor live: it folds that editor's annotation/proposal plugin
// state into one position-ordered list plus a pending count, updating as commands mutate the editor.
// Driven through a real headless editor.

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createAnnotation, markAnnotationRead } from '../extensions/annotations'
import { acceptProposal, createProposal } from '../extensions/proposals'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { useEditorSuggestions } from '../useEditorSuggestions'

const CONTENT = 'The quick brown fox jumps over the lazy dog and keeps running onward.'

const ANNOTATION = {
  from: 20,
  to: 25,
  label: 'Tense',
  description: 'Soften it',
  severity: 'warning' as const,
  quote: 'jumps'
}

describe('useEditorSuggestions', () => {
  it('is empty before any suggestion, then lists them in document order with a pending count', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(() => useEditorSuggestions(editor))
      expect(result.current).toEqual({ items: [], pendingCount: 0 })

      act(() => {
        createProposal({
          editor,
          proposal: {
            from: 2,
            to: 6,
            originalText: 'e qu',
            replacementText: 'A',
            content: { type: 'doc', content: [] }
          }
        })
        createAnnotation({ editor, annotation: ANNOTATION })
      })

      expect(result.current.items.map((item) => [item.id, item.type])).toEqual([
        ['p_1', 'rewrite'],
        ['a_1', 'note']
      ])
      expect(result.current.pendingCount).toBe(2)
    } finally {
      editor.destroy()
    }
  })

  it('drops the pending count as suggestions are resolved', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(() => useEditorSuggestions(editor))
      act(() => {
        createAnnotation({ editor, annotation: ANNOTATION })
      })
      expect(result.current.pendingCount).toBe(1)

      act(() => markAnnotationRead({ editor, id: 'a_1' }))
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.items).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })

  it('removes an accepted proposal from the list', () => {
    const editor = createTestEditor(CONTENT)
    try {
      const { result } = renderHook(() => useEditorSuggestions(editor))
      act(() => {
        createProposal({
          editor,
          proposal: {
            from: 2,
            to: 6,
            originalText: editor.state.doc.textBetween(2, 6, '\n'),
            replacementText: 'A',
            content: { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
          }
        })
      })
      expect(result.current.pendingCount).toBe(1)

      act(() => acceptProposal({ editor, id: 'p_1' }))
      expect(result.current.items).toEqual([])
      expect(result.current.pendingCount).toBe(0)
    } finally {
      editor.destroy()
    }
  })
})
