// useAgentContextUsage reads the AgentContextUsage off the agent's shared state and re-renders when it
// changes. A fake AbstractAgent drives onStateChanged through the subscriber it is handed — no IPC. We
// assert it initializes from the current state, follows updates (including a clear), and unsubscribes.

import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { type BaseEvent, type State } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { useAgentContextUsage } from '../useAgentContextUsage'

const usage = {
  usedTokens: 12_400,
  windowTokens: 1_000_000,
  breakdown: { inputTokens: 1200, cacheReadTokens: 11_000, cacheCreationTokens: 200 }
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

  emitState(state: State): void {
    void this.sub?.onStateChanged?.({ messages: [], state, agent: this })
  }

  hasSubscriber(): boolean {
    return this.sub !== undefined
  }
}

function Probe({ agent }: { agent: AbstractAgent }): React.JSX.Element {
  const result = useAgentContextUsage(agent)
  return <span data-testid="used">{result === undefined ? 'none' : String(result.usedTokens)}</span>
}

describe('useAgentContextUsage', () => {
  it('initializes from the agent current state', () => {
    const agent = new FakeAgent()
    agent.setState({ contextUsage: usage })

    const { getByTestId } = render(<Probe agent={agent} />)
    expect(getByTestId('used').textContent).toBe('12400')
  })

  it('follows state changes and clears when usage is gone', () => {
    const agent = new FakeAgent()

    const { getByTestId } = render(<Probe agent={agent} />)
    expect(getByTestId('used').textContent).toBe('none')

    act(() => agent.emitState({ contextUsage: usage }))
    expect(getByTestId('used').textContent).toBe('12400')

    act(() => agent.emitState({}))
    expect(getByTestId('used').textContent).toBe('none')
  })

  it('unsubscribes on unmount', () => {
    const agent = new FakeAgent()
    const { unmount } = render(<Probe agent={agent} />)
    expect(agent.hasSubscriber()).toBe(true)

    unmount()
    expect(agent.hasSubscriber()).toBe(false)
  })
})
