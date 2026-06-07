// create_annotation: success anchors a note to a resolved range and defaults severity to 'warning';
// missing and drifted ranges fail recoverably.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { getAnnotations } from '../../../editor/extensions/annotations'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getRanges } from '../tool-get-ranges'
import { createAnnotationTool } from '../tool-create-annotation'
import { stringField } from './result-helpers'

function resolveRangeId(editor: Editor, text: string): string {
  return stringField(getRanges(editor, { text }), 'rangeId')
}

describe('createAnnotationTool', () => {
  it('annotates a resolved range and defaults severity to warning', () => {
    withEditor('hello world', (editor) => {
      const rangeId = resolveRangeId(editor, 'world')
      const result = createAnnotationTool(editor, {
        rangeId,
        label: 'word choice',
        description: 'consider a stronger noun'
      })

      expect(result.ok).toBe(true)
      const annotations = getAnnotations(editor)
      expect(annotations).toHaveLength(1)
      expect(annotations[0]?.severity).toBe('warning')
      expect(annotations[0]?.quote).toBe('world')
    })
  })

  it('honors an explicit severity', () => {
    withEditor('hello world', (editor) => {
      const rangeId = resolveRangeId(editor, 'world')
      const result = createAnnotationTool(editor, {
        rangeId,
        label: 'typo',
        description: 'fix this',
        severity: 'error'
      })

      expect(result.ok).toBe(true)
      expect(getAnnotations(editor)[0]?.severity).toBe('error')
    })
  })

  it('fails when the range id is unknown', () => {
    withEditor('hello world', (editor) => {
      const result = createAnnotationTool(editor, {
        rangeId: 'r_99',
        label: 'x',
        description: 'y'
      })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error).toContain('not found')
    })
  })

  it('fails when the range text has drifted', () => {
    withEditor('hello world', (editor) => {
      const rangeId = resolveRangeId(editor, 'world')
      editor.commands.setContent('hello there')

      const result = createAnnotationTool(editor, {
        rangeId,
        label: 'x',
        description: 'y'
      })
      expect(result.ok).toBe(false)
    })
  })
})
