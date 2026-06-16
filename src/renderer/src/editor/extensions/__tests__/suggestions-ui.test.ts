// Per-editor suggestion UI state: visibility defaults on and toggles via the setMeta command.

import { describe, expect, it } from 'vitest'
import { getSuggestionsVisible, setSuggestionsVisible } from '../suggestions-ui'
import { withEditor } from './editor-test-harness'

describe('suggestions-ui extension', () => {
  it('defaults to visible', () => {
    withEditor('hello world', (editor) => {
      expect(getSuggestionsVisible(editor)).toBe(true)
    })
  })

  it('hides and re-shows suggestions on command', () => {
    withEditor('hello world', (editor) => {
      setSuggestionsVisible({ editor, visible: false })
      expect(getSuggestionsVisible(editor)).toBe(false)

      setSuggestionsVisible({ editor, visible: true })
      expect(getSuggestionsVisible(editor)).toBe(true)
    })
  })
})
