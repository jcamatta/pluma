// Annotation tracking: sequential ids, active selection, and removal clearing the active id.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import {
  createAnnotation,
  delAnnotation,
  getActiveAnnotationId,
  getAnnotations,
  markAnnotationRead,
  setActiveAnnotation
} from '../annotations'
import { withEditor } from './editor-test-harness'

function annotate(editor: Editor, label: string): ReturnType<typeof createAnnotation> {
  return createAnnotation({
    editor,
    annotation: { from: 1, to: 3, label, description: 'note', severity: 'warning', quote: 'he' }
  })
}

function statusOf(editor: Editor, id: string): string | undefined {
  return getAnnotations(editor).find((annotation) => annotation.id === id)?.status
}

describe('annotations extension', () => {
  it('mints sequential ids and stores annotations', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, 'one')
      const second = annotate(editor, 'two')

      expect(first.id).toBe('a_1')
      expect(second.id).toBe('a_2')
      expect(getAnnotations(editor)).toHaveLength(2)
    })
  })

  it('mints new annotations as pending', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, 'one')
      expect(statusOf(editor, annotation.id)).toBe('pending')
    })
  })

  it('marks one annotation read and leaves others untouched', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, 'one')
      const second = annotate(editor, 'two')

      markAnnotationRead({ editor, id: first.id })

      expect(statusOf(editor, first.id)).toBe('read')
      expect(statusOf(editor, second.id)).toBe('pending')
    })
  })

  it('toggles the active annotation', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, 'one')

      setActiveAnnotation({ editor, id: annotation.id })
      expect(getActiveAnnotationId(editor)).toBe(annotation.id)

      setActiveAnnotation({ editor, id: null })
      expect(getActiveAnnotationId(editor)).toBeNull()
    })
  })

  it('clears the active id when the active annotation is removed', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, 'one')
      setActiveAnnotation({ editor, id: annotation.id })

      delAnnotation({ editor, id: annotation.id })

      expect(getAnnotations(editor)).toHaveLength(0)
      expect(getActiveAnnotationId(editor)).toBeNull()
    })
  })

  it('keeps the active id when a different annotation is removed', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, 'one')
      const second = annotate(editor, 'two')
      setActiveAnnotation({ editor, id: second.id })

      delAnnotation({ editor, id: first.id })

      expect(getActiveAnnotationId(editor)).toBe(second.id)
    })
  })
})
