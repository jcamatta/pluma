// create_annotation: success anchors a note to the resolved passage and defaults severity to
// 'warning'; absent text fails not_found and repeated text fails ambiguous.

import { describe, expect, it } from 'vitest'
import { getAnnotations } from '../../../editor/extensions/annotations'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { createAnnotationTool } from '../tool-create-annotation'

describe('createAnnotationTool', () => {
  it('annotates the resolved passage and defaults severity to warning', () => {
    withEditor('hello world', (editor) => {
      const result = createAnnotationTool(editor, {
        text: 'world',
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
      const result = createAnnotationTool(editor, {
        text: 'world',
        label: 'typo',
        description: 'fix this',
        severity: 'error'
      })

      expect(result.ok).toBe(true)
      expect(getAnnotations(editor)[0]?.severity).toBe('error')
    })
  })

  it('fails not_found when the text is absent', () => {
    withEditor('hello world', (editor) => {
      const result = createAnnotationTool(editor, { text: 'missing', label: 'x', description: 'y' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('fails ambiguous when the text occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = createAnnotationTool(editor, { text: 'the', label: 'x', description: 'y' })
      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
    })
  })
})
