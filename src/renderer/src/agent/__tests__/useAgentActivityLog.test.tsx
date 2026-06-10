// useAgentActivityLog wires the agent's onEvent subscription to reduceActivity and re-renders on each
// event. A fake AbstractAgent emits scripted events through the subscriber it is handed — no IPC. The
// folding itself is covered in activity-log.test; here we assert the subscription drives re-renders and
// that unsubscribe runs on unmount.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { EventType, type BaseEvent } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { useAgentActivityLog } from '../useAgentActivityLog'
import type { ActivityLabels } from '../activity-log'

const labels: ActivityLabels = {
  calling: (tool) => `Calling ${tool}`,
  done: (tool) => `${tool} done`,
  runError: (message) => message
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

  emit(event: BaseEvent): void {
    void this.sub?.onEvent?.({
      event,
      messages: [],
      state: {},
      agent: this,
      input: this.makeInput()
    })
  }

  hasSubscriber(): boolean {
    return this.sub !== undefined
  }

  private makeInput(): RunAgentInput {
    return {
      threadId: '',
      runId: '',
      messages: [],
      tools: [],
      context: [],
      forwardedProps: {},
      state: {}
    }
  }
}

describe('useAgentActivityLog', () => {
  it('folds emitted events and re-renders with the latest activity', () => {
    const agent = new FakeAgent()

    function Probe(): React.JSX.Element {
      const activity = useAgentActivityLog(agent, labels)
      return (
        <div>
          <span data-testid="status">{activity.status}</span>
          <span data-testid="summary">{activity.summary}</span>
        </div>
      )
    }

    const { getByTestId } = render(<Probe />)
    expect(getByTestId('status').textContent).toBe('idle')

    act(() => agent.emit({ type: EventType.RUN_STARTED }))
    expect(getByTestId('status').textContent).toBe('working')

    act(() => agent.emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'hi' }))
    expect(getByTestId('summary').textContent).toBe('hi')

    act(() => agent.emit({ type: EventType.RUN_FINISHED }))
    expect(getByTestId('status').textContent).toBe('done')
  })

  it('unsubscribes on unmount', () => {
    const agent = new FakeAgent()

    function Probe(): React.JSX.Element {
      useAgentActivityLog(agent, labels)
      return <div />
    }

    const { unmount } = render(<Probe />)
    expect(agent.hasSubscriber()).toBe(true)

    unmount()
    expect(agent.hasSubscriber()).toBe(false)
  })
})
