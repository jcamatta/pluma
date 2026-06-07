// useAgent: returns the agent instance from context and re-renders the component when the agent
// reports a message change, so reads of agent.messages stay current. Uses a fake AbstractAgent that
// emits a scripted onMessagesChanged — no IPC.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import type { BaseEvent, Message } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { AgentContext } from '../AgentContext'
import { useAgent } from '../useAgent'

class FakeAgent extends AbstractAgent {
  private notify: (() => void) | undefined

  run(input: RunAgentInput): Observable<BaseEvent> {
    void input
    return new Observable<BaseEvent>((subscriber) => subscriber.complete())
  }

  override subscribe(sub: AgentSubscriber): { unsubscribe: () => void } {
    this.notify = () =>
      void sub.onMessagesChanged?.({ messages: this.messages, state: {}, agent: this })
    return { unsubscribe: () => (this.notify = undefined) }
  }

  pushMessage(message: Message): void {
    this.messages = [...this.messages, message]
    this.notify?.()
  }
}

describe('useAgent', () => {
  it('exposes the agent and re-renders on message changes', () => {
    const agent = new FakeAgent()

    function Probe(): React.JSX.Element {
      const { agent: live } = useAgent()
      return <div data-testid="count">{live.messages.length}</div>
    }

    const { getByTestId } = render(
      <AgentContext.Provider value={agent}>
        <Probe />
      </AgentContext.Provider>
    )

    expect(getByTestId('count').textContent).toBe('0')

    act(() => agent.pushMessage({ id: 'm1', role: 'assistant', content: 'hello' }))
    expect(getByTestId('count').textContent).toBe('1')
  })
})
