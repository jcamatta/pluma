// messageText is a pure calculation: a string content passes through, an array of parts joins its text
// parts, and anything else yields an empty string.

import { describe, expect, it } from 'vitest'
import type { Message } from '@ag-ui/core'
import { messageText } from '../message-text'

describe('messageText', () => {
  it('returns string content unchanged', () => {
    const message: Message = { id: 'm1', role: 'user', content: 'hello' }
    expect(messageText(message)).toBe('hello')
  })

  it('returns an empty string when content is absent', () => {
    const message: Message = { id: 'm1', role: 'assistant' }
    expect(messageText(message)).toBe('')
  })
})
