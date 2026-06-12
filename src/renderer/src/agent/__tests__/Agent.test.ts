// Agent thread seeding: seedThread adopts a selected thread so the next run resumes its SDK session and
// the agent shows its stored history; newThread clears both so the next run opens a fresh session. The
// resume id is read through a probe subclass exposing the protected resumeThreadId(); window.api is a
// stub since these methods touch neither IPC nor the network.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@ag-ui/core'
import { Agent } from '../adapters/Agent'

class ProbeAgent extends Agent {
  threadIdForNextRun(): string {
    return this.resumeThreadId()
  }
}

function makeAgent(): ProbeAgent {
  vi.stubGlobal('api', { invoke: vi.fn(), on: vi.fn(() => () => undefined) })
  return new ProbeAgent()
}

afterEach(() => vi.unstubAllGlobals())

const history: readonly Message[] = [
  { id: 'm1', role: 'user', content: 'hello' },
  { id: 'm2', role: 'assistant', content: 'hi' }
]

describe('Agent thread seeding', () => {
  it('resumes the selected thread id and shows its history on the next run', () => {
    const agent = makeAgent()
    agent.seedThread('session-1', history)
    expect(agent.threadIdForNextRun()).toBe('session-1')
    expect(agent.messages).toEqual([...history])
  })

  it('newThread clears the resume id and the transcript', () => {
    const agent = makeAgent()
    agent.seedThread('session-1', history)
    agent.newThread()
    expect(agent.threadIdForNextRun()).toBe('')
    expect(agent.messages).toEqual([])
  })
})
