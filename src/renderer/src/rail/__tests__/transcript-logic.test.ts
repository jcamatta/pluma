// splitConversation separates the settled history (plain bubbles) from the current turn's prompt (which
// the live activity renders). Pure — no setup.

import { describe, expect, it } from 'vitest'
import type { Message } from '@ag-ui/core'
import { splitConversation } from '../transcript-logic'

const user = (id: string, content: string): Message => ({ id, role: 'user', content })
const assistant = (id: string, content: string): Message => ({ id, role: 'assistant', content })

describe('splitConversation', () => {
  it('treats the whole conversation as history when no run is live', () => {
    const messages = [user('u1', 'hi'), assistant('a1', 'hello'), user('u2', 'again')]
    expect(splitConversation(messages, false)).toEqual({
      history: [
        { id: 'u1', role: 'user', text: 'hi' },
        { id: 'a1', role: 'assistant', text: 'hello' },
        { id: 'u2', role: 'user', text: 'again' }
      ],
      currentPrompt: null
    })
  })

  it('peels the current turn (from the last user message) off the history while live', () => {
    const messages = [user('u1', 'hi'), assistant('a1', 'hello'), user('u2', 'again')]
    expect(splitConversation(messages, true)).toEqual({
      history: [
        { id: 'u1', role: 'user', text: 'hi' },
        { id: 'a1', role: 'assistant', text: 'hello' }
      ],
      currentPrompt: 'again'
    })
  })

  it('keeps the current turn out of history even as its reply streams in', () => {
    const messages = [user('u1', 'hi'), assistant('a1', 'streaming…')]
    expect(splitConversation(messages, true)).toEqual({
      history: [],
      currentPrompt: 'hi'
    })
  })

  it('drops tool, system, and empty turns from the history', () => {
    const messages: Message[] = [
      user('u1', 'go'),
      { id: 's1', role: 'system', content: 'internal' },
      { id: 't1', role: 'tool', content: 'result', toolCallId: 'c1' },
      assistant('a1', '   '),
      assistant('a2', 'done'),
      user('u2', 'next')
    ]
    expect(splitConversation(messages, true).history).toEqual([
      { id: 'u1', role: 'user', text: 'go' },
      { id: 'a2', role: 'assistant', text: 'done' }
    ])
  })

  it('trims the current prompt and history content', () => {
    expect(splitConversation([user('u1', '  spaced  ')], true)).toEqual({
      history: [],
      currentPrompt: 'spaced'
    })
  })
})
