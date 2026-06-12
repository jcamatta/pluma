// Agent thread seeding: seedThread adopts a selected thread so the next run resumes its SDK session and
// the agent shows its stored history; newThread clears both so the next run opens a fresh session. The
// resume id is read through a probe subclass exposing the protected resumeThreadId(); window.api is a
// stub since these methods touch neither IPC nor the network. The probe also exposes startRun so the run
// state riding forwardedProps (model/effort) can be asserted on the IPC payload.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@ag-ui/core'
import type { RunAgentInput } from '@ag-ui/client'
import type { RunAgentInput as IpcRunAgentInput } from '../../../../shared/ipc/ipc-contract/agent'
import { Agent, type StartRunResult } from '../adapters/Agent'

class ProbeAgent extends Agent {
  threadIdForNextRun(): string {
    return this.resumeThreadId()
  }

  start(input: RunAgentInput): Promise<StartRunResult> {
    return this.startRun(input)
  }
}

const baseInput: RunAgentInput = {
  threadId: '',
  runId: 'run-1',
  messages: [],
  tools: [],
  context: [],
  forwardedProps: {},
  state: {}
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

describe('Agent run state', () => {
  it('preserves the run state passed via forwardedProps in the startRun payload', async () => {
    const sent: IpcRunAgentInput[] = []
    const invoke = vi.fn((_channel: string, payload: IpcRunAgentInput) => {
      sent.push(payload)
      return Promise.resolve({ ok: true, value: { runId: 'run-1' } })
    })
    vi.stubGlobal('api', { invoke, on: vi.fn(() => () => undefined) })

    const agent = new ProbeAgent()
    await agent.start({
      ...baseInput,
      forwardedProps: { state: { model: 'claude-sonnet-4-6', effort: 'high' } }
    })

    expect(sent[0]?.state).toEqual({ model: 'claude-sonnet-4-6', effort: 'high' })
  })

  it('omits state from the payload when forwardedProps carries none', async () => {
    const sent: IpcRunAgentInput[] = []
    const invoke = vi.fn((_channel: string, payload: IpcRunAgentInput) => {
      sent.push(payload)
      return Promise.resolve({ ok: true, value: { runId: 'run-1' } })
    })
    vi.stubGlobal('api', { invoke, on: vi.fn(() => () => undefined) })

    const agent = new ProbeAgent()
    await agent.start(baseInput)

    expect(sent[0] !== undefined && 'state' in sent[0]).toBe(false)
  })
})
