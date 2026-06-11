// Tests for toSdkPrompt: the calculation mapping the AG-UI conversation to Claude SDK streaming input.
// Covers sending only the new user input (history is carried by `resume`, not replayed), array content
// flattened to text, and the SDK envelope shape.

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

  it('sends only the new user turn after a reply, not the replayed history', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'it works' },
      { id: '2', role: 'assistant', content: 'glad to hear it' },
      { id: '3', role: 'user', content: 'second message' }
    ]

    expect(toSdkPrompt(messages)).toStrictEqual([
      {
        type: 'user',
        parent_tool_use_id: null,
        message: { role: 'user', content: 'second message' }
      }
    ])
  })

  it('drops assistant and non-user turns from the new input', () => {
    const messages: Message[] = [
      { id: '1', role: 'system', content: 's' },
      { id: '2', role: 'user', content: 'u' },
      { id: '3', role: 'tool', content: 't', toolCallId: 'c1' }
    ]

    expect(toSdkPrompt(messages).map((m) => m.message.content)).toStrictEqual(['u'])
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
