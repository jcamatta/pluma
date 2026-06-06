// Tests for toSdkPrompt: the calculation mapping the AG-UI conversation to Claude SDK streaming input.
// Covers role mapping (user/assistant/system kept, others dropped), array content flattened to text, and
// the SDK envelope shape.

import type { Message } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import { toSdkPrompt } from '../to-sdk-prompt'

describe('toSdkPrompt', () => {
  it('maps a user message to an SDK user-input message', () => {
    const messages: Message[] = [{ id: '1', role: 'user', content: 'hello' }]

    expect(toSdkPrompt(messages)).toStrictEqual([
      { type: 'user', parent_tool_use_id: null, message: { role: 'user', content: 'hello' } }
    ])
  })

  it('keeps user, assistant and system turns and drops other roles', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'u' },
      { id: '2', role: 'assistant', content: 'a' },
      { id: '3', role: 'system', content: 's' },
      { id: '4', role: 'tool', content: 't', toolCallId: 'c1' }
    ]

    expect(toSdkPrompt(messages).map((m) => m.message.role)).toStrictEqual([
      'user',
      'assistant',
      'system'
    ])
  })

  it('flattens array text content to a newline-joined string', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: [
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' }
        ]
      }
    ]

    expect(toSdkPrompt(messages)[0].message.content).toBe('one\ntwo')
  })
})
