// useRunFailed exposes the current run's failure code: set from the error the agent reports through
// onRunFailed (its typed code when the error is an AgentRunError, 'generic' otherwise), cleared to null
// when the next run initializes. A fake AbstractAgent drives those callbacks through the subscriber it
// is handed — no IPC.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { type BaseEvent } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { AgentRunError } from '../../agent/agent-run-error'
import { useRunFailed } from '../useRunFailed'

const INPUT: RunAgentInput = {
  threadId: '',
  runId: '',
  messages: [],
  tools: [],
  context: [],
  forwardedProps: {},
  state: {}
}

class FakeAgent extends AbstractAgent {
  private sub: AgentSubscriber | undefined

  run(input: RunAgentInput): Observable<BaseEvent> {
    void input
    return new Observable<BaseEvent>((subscriber) => subscriber.complete())
  }

  override subscribe(sub: AgentSubscriber): { unsubscribe: () => void } {
    this.sub = sub
    return { unsubscribe: () => (this.sub = undefined) }
  }

  fail(error: Error = new Error('boom')): void {
    void this.sub?.onRunFailed?.({
      error,
      messages: [],
      state: {},
      agent: this,
      input: INPUT
    })
  }

  start(): void {
    void this.sub?.onRunInitialized?.({ messages: [], state: {}, agent: this, input: INPUT })
  }
}

function renderFailure(agent: FakeAgent): { readonly read: () => string } {
  function Probe(): React.JSX.Element {
    return <span data-testid="failed">{String(useRunFailed(agent))}</span>
  }

  const { getByTestId } = render(<Probe />)
  return { read: () => getByTestId('failed').textContent ?? '' }
}

describe('useRunFailed', () => {
  it('reports a failure code and clears when the next run starts', () => {
    const agent = new FakeAgent()
    const { read } = renderFailure(agent)
    expect(read()).toBe('null')

    act(() => agent.fail(new AgentRunError('boom', 'authentication')))
    expect(read()).toBe('authentication')

    act(() => agent.start())
    expect(read()).toBe('null')
  })

  it('falls back to generic for an error that carries no failure code', () => {
    const agent = new FakeAgent()
    const { read } = renderFailure(agent)

    act(() => agent.fail())
    expect(read()).toBe('generic')
  })
})
