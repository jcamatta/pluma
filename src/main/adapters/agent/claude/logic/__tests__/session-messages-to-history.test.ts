// Tests for sessionMessagesToHistory: the calculation mapping the SDK's session message chain to AG-UI
// Messages. Verifies text extraction and role carry-through, that system and empty turns are dropped, and
// that tool activity is reconstructed — assistant tool_use blocks become toolCalls, and a user turn's
// tool_result blocks become `tool` messages linked by toolCallId.

import { describe, expect, it } from 'vitest'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { sessionMessagesToHistory } from '../session-messages-to-history'

const entry = (fields: {
  type: SessionMessage['type']
  uuid: string
  message: unknown
}): SessionMessage => ({ ...fields, session_id: 'sess', parent_tool_use_id: null })

describe('sessionMessagesToHistory text and roles', () => {
  it('extracts string and text-block contents and keeps roles', () => {
    const history = sessionMessagesToHistory([
      entry({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi there' } }),
      entry({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'hello ' },
            { type: 'text', text: 'world' }
          ]
        }
      })
    ])
    expect(history).toStrictEqual([
      { id: 'u1', role: 'user', content: 'hi there' },
      { id: 'a1', role: 'assistant', content: 'hello world' }
    ])
  })

  it('drops system entries', () => {
    const history = sessionMessagesToHistory([
      entry({ type: 'system', uuid: 's1', message: { content: 'boot' } })
    ])
    expect(history).toStrictEqual([])
  })
})

describe('sessionMessagesToHistory tool reconstruction', () => {
  it('reconstructs assistant tool_use blocks into toolCalls alongside the text', () => {
    const history = sessionMessagesToHistory([
      entry({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'let me read' },
            { type: 'tool_use', id: 't1', name: 'read', input: { path: 'a.md' } }
          ]
        }
      })
    ])
    expect(history).toStrictEqual([
      {
        id: 'a1',
        role: 'assistant',
        content: 'let me read',
        toolCalls: [
          { id: 't1', type: 'function', function: { name: 'read', arguments: '{"path":"a.md"}' } }
        ]
      }
    ])
  })

  it('keeps a tool-only assistant turn, carrying just its toolCalls', () => {
    const history = sessionMessagesToHistory([
      entry({
        type: 'assistant',
        uuid: 'a2',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't', name: 'ls', input: {} }]
        }
      })
    ])
    expect(history).toStrictEqual([
      {
        id: 'a2',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 't', type: 'function', function: { name: 'ls', arguments: '{}' } }]
      }
    ])
  })

  it('maps a user turn of tool_result blocks to tool messages linked by toolCallId', () => {
    const history = sessionMessagesToHistory([
      entry({
        type: 'user',
        uuid: 'u2',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok' }]
        }
      })
    ])
    expect(history).toStrictEqual([
      { id: 'result-c1', role: 'tool', toolCallId: 'c1', content: 'ok' }
    ])
  })
})
