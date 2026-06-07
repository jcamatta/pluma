// get_ranges: single match registers a range; zero matches -> not_found; multiple -> ambiguous with
// a preview per occurrence. The single-match case also checks the returned range resolves the same
// text via the ranges extension.

import { describe, expect, it } from 'vitest'
import { getRange } from '../../../editor/extensions/ranges'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getRanges } from '../tool-get-ranges'
import { stringField } from './result-helpers'

describe('getRanges', () => {
  it('registers a range for a single match', () => {
    withEditor('hello world', (editor) => {
      const rangeId = stringField(getRanges(editor, { text: 'world' }), 'rangeId')

      const range = getRange({ editor, id: rangeId })
      expect(range?.originalText).toBe('world')
      expect(range?.status).toBe('ok')
    })
  })

  it('returns not_found when the text is absent', () => {
    withEditor('hello world', (editor) => {
      const result = getRanges(editor, { text: 'missing' })
      expect(result).toEqual({ ok: false, error: 'not_found' })
    })
  })

  it('returns ambiguous with a preview when the text occurs more than once', () => {
    withEditor('the cat sat on the mat', (editor) => {
      const result = getRanges(editor, { text: 'the' })

      if (result.ok) return expect.fail('expected failure')
      expect(result.error.startsWith('ambiguous\n')).toBe(true)
      expect(result.error).toContain('1: ')
      expect(result.error).toContain('2: ')
    })
  })
})
