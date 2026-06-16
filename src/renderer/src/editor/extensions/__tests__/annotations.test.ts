// Annotation tracking: sequential ids, active selection, and removal clearing the active id.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import {
  annotationActiveClass,
  annotationReadClass,
  createAnnotation,
  delAnnotation,
  getActiveAnnotationId,
  getAnnotations,
  markAnnotationRead,
  setActiveAnnotation
} from '../annotations'
import { setActiveProposal } from '../proposals'
import { getActiveSuggestionId, setSuggestionsVisible } from '../suggestions-ui'
import { withEditor } from './editor-test-harness'

function annotate(
  editor: Editor,
  options: { label: string; from?: number; to?: number }
): ReturnType<typeof createAnnotation> {
  return createAnnotation({
    editor,
    annotation: {
      from: options.from ?? 1,
      to: options.to ?? 3,
      label: options.label,
      description: 'note',
      severity: 'warning',
      quote: 'he'
    }
  })
}

// Counts the annotation highlight spans the plugin renders into the editor DOM.
function highlightCount(editor: Editor): number {
  return editor.view.dom.querySelectorAll('.annotation-warning').length
}

function statusOf(editor: Editor, id: string): string | undefined {
  return getAnnotations(editor).find((annotation) => annotation.id === id)?.status
}

describe('annotations extension', () => {
  it('mints sequential ids and stores annotations', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, { label: 'one' })
      const second = annotate(editor, { label: 'two' })

      expect(first.id).toBe('a_1')
      expect(second.id).toBe('a_2')
      expect(getAnnotations(editor)).toHaveLength(2)
    })
  })

  it('mints new annotations as pending', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one' })
      expect(statusOf(editor, annotation.id)).toBe('pending')
    })
  })

  it('marks one annotation read and leaves others untouched', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, { label: 'one' })
      const second = annotate(editor, { label: 'two' })

      markAnnotationRead({ editor, id: first.id })

      expect(statusOf(editor, first.id)).toBe('read')
      expect(statusOf(editor, second.id)).toBe('pending')
    })
  })

  it('toggles the active annotation', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one' })

      setActiveAnnotation({ editor, id: annotation.id })
      expect(getActiveAnnotationId(editor)).toBe(annotation.id)

      setActiveAnnotation({ editor, id: null })
      expect(getActiveAnnotationId(editor)).toBeNull()
    })
  })

  it('clears the active id when the active annotation is removed', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one' })
      setActiveAnnotation({ editor, id: annotation.id })

      delAnnotation({ editor, id: annotation.id })

      expect(getAnnotations(editor)).toHaveLength(0)
      expect(getActiveAnnotationId(editor)).toBeNull()
    })
  })

  it('keeps the active id when a different annotation is removed', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, { label: 'one' })
      const second = annotate(editor, { label: 'two' })
      setActiveAnnotation({ editor, id: second.id })

      delAnnotation({ editor, id: first.id })

      expect(getActiveAnnotationId(editor)).toBe(second.id)
    })
  })
})

describe('annotations extension shared cross-type active id', () => {
  it('delegates the active annotation id to the shared suggestions-ui state', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one' })

      setActiveAnnotation({ editor, id: annotation.id })
      expect(getActiveSuggestionId(editor)).toBe(annotation.id)
      expect(getActiveAnnotationId(editor)).toBe(annotation.id)
    })
  })

  it('returns null from getActiveAnnotationId when the shared id names a proposal', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one' })

      setActiveAnnotation({ editor, id: annotation.id })
      // Activating a proposal (an id this editor's annotations do not own) deactivates the annotation.
      setActiveProposal({ editor, id: 'p_1' })

      expect(getActiveAnnotationId(editor)).toBeNull()
    })
  })

  it('tags only the active annotation highlight with the active class', () => {
    withEditor('hello world', (editor) => {
      const first = annotate(editor, { label: 'one', from: 1, to: 3 })
      annotate(editor, { label: 'two', from: 7, to: 12 })

      setActiveAnnotation({ editor, id: first.id })

      expect(editor.view.dom.querySelectorAll(`.${annotationActiveClass}`)).toHaveLength(1)
      expect(highlightCount(editor)).toBe(2)
    })
  })
})

describe('annotations extension render-all visibility', () => {
  it('highlights every annotation at once without any active selection', () => {
    withEditor('hello world', (editor) => {
      annotate(editor, { label: 'one', from: 1, to: 3 })
      annotate(editor, { label: 'two', from: 7, to: 12 })

      expect(getActiveAnnotationId(editor)).toBeNull()
      expect(highlightCount(editor)).toBe(2)
    })
  })

  it('clears every highlight when suggestions are hidden and restores them on show', () => {
    withEditor('hello world', (editor) => {
      annotate(editor, { label: 'one', from: 1, to: 3 })
      annotate(editor, { label: 'two', from: 7, to: 12 })

      setSuggestionsVisible({ editor, visible: false })
      expect(highlightCount(editor)).toBe(0)

      setSuggestionsVisible({ editor, visible: true })
      expect(highlightCount(editor)).toBe(2)
    })
  })

  it('adds the read recipe class to a highlight once its annotation is marked read', () => {
    withEditor('hello world', (editor) => {
      const annotation = annotate(editor, { label: 'one', from: 1, to: 3 })

      markAnnotationRead({ editor, id: annotation.id })

      const span = editor.view.dom.querySelector(`.${annotationReadClass}`)
      expect(span?.classList.contains('annotation-warning')).toBe(true)
    })
  })
})
