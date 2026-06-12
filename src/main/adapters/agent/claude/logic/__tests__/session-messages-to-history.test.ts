// Tests for sessionMessagesToHistory: the calculation mapping the SDK's session message chain to AG-UI
// Messages. Verifies string and text-block array contents are extracted, user/assistant roles carry
// through, system entries and text-less turns (e.g. tool-only assistant turns) are dropped.

import { describe, expect, it } from 'vitest'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { sessionMessagesToHistory } from '../session-messages-to-history'

const entry = (fields: {
  type: SessionMessage['type']
  uuid: string
  message: unknown
}): SessionMessage => ({ ...fields, session_id: 'sess', parent_tool_use_id: null })

describe('sessionMessagesToHistory', () => {
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

  it('drops system entries and text-less turns', () => {
    const history = sessionMessagesToHistory([
      entry({ type: 'system', uuid: 's1', message: { content: 'boot' } }),
      entry({
        type: 'assistant',
        uuid: 'a2',
        message: { role: 'assistant', content: [{ type: 'tool_use', id: 't' }] }
      })
    ])
    expect(history).toStrictEqual([])
  })
})
