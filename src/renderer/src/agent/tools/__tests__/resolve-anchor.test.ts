// resolveAnchor: a single match resolves to a span covering the text; zero matches -> not_found;
// multiple -> ambiguous with a preview per occurrence.

import { describe, expect, it } from 'vitest'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { resolveAnchor } from '../resolve-anchor'

describe('resolveAnchor', () => {
  it('resolves a single match to a span covering the text', () => {
    withEditor('hello world', (editor) => {
      const resolved = resolveAnchor(editor, 'world')

      if (!resolved.ok) return expect.fail('expected a resolved span')
      expect(resolved.text).toBe('world')
      expect(editor.state.doc.textBetween(resolved.from, resolved.to, '\n')).toBe('world')
    })
  })

  it('returns not_found when the text is absent', () => {
    withEditor('hello world', (editor) => {
      expect(resolveAnchor(editor, 'missing')).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('returns ambiguous with a preview when the text occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const resolved = resolveAnchor(editor, 'the')

      if (resolved.ok) return expect.fail('expected failure')
      expect(resolved.error.startsWith('ambiguous\n')).toBe(true)
      expect(resolved.error).toContain('1: ')
      expect(resolved.error).toContain('2: ')
    })
  })
})
