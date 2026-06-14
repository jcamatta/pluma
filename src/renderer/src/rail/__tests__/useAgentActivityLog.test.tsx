// useAgentActivityLog wires the agent's onEvent subscription to reduceActivity and re-renders on each
// event. A fake AbstractAgent emits scripted events through the subscriber it is handed — no IPC. The
// folding itself is covered in activity-log.test; here we assert the subscription drives re-renders and
// that unsubscribe runs on unmount.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { EventType, type BaseEvent, type Message } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { useAgentActivityLog } from '../useAgentActivityLog'
import type { ActivityLabels } from '../activity-log'

const labels: ActivityLabels = {
  calling: (tool) => `Calling ${tool}`,
  done: (tool) => `${tool} done`,
  failed: (tool) => `${tool} failed`,
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

  // AG-UI surfaces a run's lifecycle through these callbacks, not as onEvent events — the hook turns them
  // back into synthetic RUN_STARTED/RUN_FINISHED for the reducer. The fake drives them the same way.
  startRunLifecycle(): void {
    void this.sub?.onRunInitialized?.({
      messages: [],
      state: {},
      agent: this,
      input: this.makeInput()
    })
  }

  finishRunLifecycle(): void {
    void this.sub?.onRunFinalized?.({
      messages: [],
      state: {},
      agent: this,
      input: this.makeInput()
    })
  }

  newMessage(role: 'user' | 'assistant'): void {
    const message: Message = { id: 'm', role, content: 'x' }
    void this.sub?.onNewMessage?.({ message, messages: [message], state: {}, agent: this })
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

    act(() => agent.startRunLifecycle())
    expect(getByTestId('status').textContent).toBe('working')

    act(() => agent.emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'hi' }))
    expect(getByTestId('summary').textContent).toBe('hi')

    act(() => agent.finishRunLifecycle())
    expect(getByTestId('status').textContent).toBe('done')
  })

  it('resets to idle when a new user message opens a turn, but not on assistant messages', () => {
    const agent = new FakeAgent()

    function Probe(): React.JSX.Element {
      const activity = useAgentActivityLog(agent, labels)
      return <span data-testid="status">{activity.status}</span>
    }

    const { getByTestId } = render(<Probe />)

    act(() => agent.startRunLifecycle())
    act(() => agent.finishRunLifecycle())
    expect(getByTestId('status').textContent).toBe('done')

    // A streamed assistant message mid-conversation must not wipe the settled activity.
    act(() => agent.newMessage('assistant'))
    expect(getByTestId('status').textContent).toBe('done')

    // The next user message starts a new turn, clearing the previous turn's activity.
    act(() => agent.newMessage('user'))
    expect(getByTestId('status').textContent).toBe('idle')
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
