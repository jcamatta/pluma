// useRunFailed exposes a single boolean: true after the agent reports onRunFailed, cleared when the next
// run initializes. A fake AbstractAgent drives those callbacks through the subscriber it is handed — no IPC.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { type BaseEvent } from '@ag-ui/core'
import { Observable } from 'rxjs'
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

  fail(): void {
    void this.sub?.onRunFailed?.({
      error: new Error('boom'),
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

describe('useRunFailed', () => {
  it('turns true on failure and clears when the next run starts', () => {
    const agent = new FakeAgent()

    function Probe(): React.JSX.Element {
      return <span data-testid="failed">{String(useRunFailed(agent))}</span>
    }

    const { getByTestId } = render(<Probe />)
    expect(getByTestId('failed').textContent).toBe('false')

    act(() => agent.fail())
    expect(getByTestId('failed').textContent).toBe('true')

    act(() => agent.start())
    expect(getByTestId('failed').textContent).toBe('false')
  })
})
