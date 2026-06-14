// Tests for createConversationRows: the pure projection of agent.messages into rail rows. Covers turn
// grouping (steps per turn, not just the last), tool-result matching by id (calling → success), an
// unsettled call left "calling", a tool-only turn still yielding a row, no text/step bleed across turns,
// that an ok:false tool result settles the step as failed, and that the live-fragmented and
// reload-consolidated shapes of one turn project to the same content.

import type { Message } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import { createConversationRows } from '../conversation-rows'

const labels = {
  calling: (name: string) => `Calling ${name}`,
  done: (name: string) => `Used ${name}`,
  failed: (name: string) => `Failed ${name}`
}
const toRows = createConversationRows(labels)

const call = (id: string, name: string): Message => ({
  id,
  role: 'assistant',
  toolCalls: [{ id, type: 'function', function: { name, arguments: '{}' } }]
})

describe('createConversationRows turns and steps', () => {
  it('keeps each turn carrying its own steps, not only the last', () => {
    const rows = toRows([
      { id: 'u1', role: 'user', content: 'one' },
      call('c1', 'read'),
      { id: 'r1', role: 'tool', toolCallId: 'c1', content: 'a' },
      { id: 'u2', role: 'user', content: 'two' },
      call('c2', 'write'),
      { id: 'r2', role: 'tool', toolCallId: 'c2', content: 'b' }
    ])

    expect(rows).toStrictEqual([
      { kind: 'user', id: 'u1', text: 'one' },
      {
        kind: 'assistant',
        id: 'c1',
        text: '',
        steps: [{ id: 'c1', status: 'success', text: 'Used read', toolName: 'read', meta: 'a' }]
      },
      { kind: 'user', id: 'u2', text: 'two' },
      {
        kind: 'assistant',
        id: 'c2',
        text: '',
        steps: [{ id: 'c2', status: 'success', text: 'Used write', toolName: 'write', meta: 'b' }]
      }
    ])
  })

  it('leaves a call without a matching result reading "calling"', () => {
    const rows = toRows([
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: 'working' },
      call('c1', 'read')
    ])

    expect(rows).toStrictEqual([
      { kind: 'user', id: 'u1', text: 'go' },
      {
        kind: 'assistant',
        id: 'a1',
        text: 'working',
        steps: [{ id: 'c1', status: 'calling', text: 'Calling read', toolName: 'read' }]
      }
    ])
  })

  it('yields an assistant row for a tool-only turn and no blank bubble', () => {
    const rows = toRows([
      call('c1', 'ls'),
      { id: 'r1', role: 'tool', toolCallId: 'c1', content: '' }
    ])

    expect(rows).toStrictEqual([
      {
        kind: 'assistant',
        id: 'c1',
        text: '',
        steps: [{ id: 'c1', status: 'success', text: 'Used ls', toolName: 'ls' }]
      }
    ])
  })
})

describe('createConversationRows failed steps', () => {
  it('settles a step as failed when its tool result is ok:false', () => {
    const rows = toRows([
      { id: 'u1', role: 'user', content: 'go' },
      call('c1', 'write'),
      { id: 'r1', role: 'tool', toolCallId: 'c1', content: '{"ok":false,"error":"nope"}' }
    ])

    expect(rows).toStrictEqual([
      { kind: 'user', id: 'u1', text: 'go' },
      {
        kind: 'assistant',
        id: 'c1',
        text: '',
        steps: [
          {
            id: 'c1',
            status: 'failed',
            text: 'Failed write',
            toolName: 'write',
            meta: '{"ok":false,"error":"nope"}'
          }
        ]
      }
    ])
  })
})

describe('createConversationRows shape normalization', () => {
  it('projects the live-fragmented and reload-consolidated shapes of a turn to the same content', () => {
    const fragmented = toRows([
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'b0', role: 'assistant', content: 'Let me check. ' },
      call('c1', 'read'),
      { id: 'r1', role: 'tool', toolCallId: 'c1', content: 'body' },
      { id: 'b2', role: 'assistant', content: 'Done.' }
    ])
    const consolidated = toRows([
      { id: 'u1', role: 'user', content: 'hi' },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Let me check. Done.',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'read', arguments: '{}' } }]
      },
      { id: 'r1', role: 'tool', toolCallId: 'c1', content: 'body' }
    ])

    const content = (rows: typeof fragmented): unknown =>
      rows.map((row) => (row.kind === 'assistant' ? { text: row.text, steps: row.steps } : row))

    expect(content(fragmented)).toStrictEqual(content(consolidated))
    expect(content(fragmented)).toStrictEqual([
      { kind: 'user', id: 'u1', text: 'hi' },
      {
        text: 'Let me check. Done.',
        steps: [{ id: 'c1', status: 'success', text: 'Used read', toolName: 'read', meta: 'body' }]
      }
    ])
  })
})
