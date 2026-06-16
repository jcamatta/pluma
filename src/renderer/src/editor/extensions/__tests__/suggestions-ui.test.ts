// Per-editor suggestion UI state: visibility defaults on and toggles via the setMeta command; a single
// cross-type active id (default null) is set and cleared the same way.

import { describe, expect, it } from 'vitest'
import {
  getActiveSuggestionId,
  getSuggestionsVisible,
  setActiveSuggestion,
  setSuggestionsVisible
} from '../suggestions-ui'
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

describe('suggestions-ui active id', () => {
  it('defaults to no active suggestion', () => {
    withEditor('hello world', (editor) => {
      expect(getActiveSuggestionId(editor)).toBeNull()
    })
  })

  it('sets and clears the single active id', () => {
    withEditor('hello world', (editor) => {
      setActiveSuggestion({ editor, id: 'p_1' })
      expect(getActiveSuggestionId(editor)).toBe('p_1')

      setActiveSuggestion({ editor, id: null })
      expect(getActiveSuggestionId(editor)).toBeNull()
    })
  })

  it('holds only one active id across reassignments', () => {
    withEditor('hello world', (editor) => {
      setActiveSuggestion({ editor, id: 'p_1' })
      setActiveSuggestion({ editor, id: 'a_1' })
      expect(getActiveSuggestionId(editor)).toBe('a_1')
    })
  })

  it('leaves visibility untouched when toggling active', () => {
    withEditor('hello world', (editor) => {
      setSuggestionsVisible({ editor, visible: false })
      setActiveSuggestion({ editor, id: 'p_1' })
      expect(getSuggestionsVisible(editor)).toBe(false)
    })
  })
})
