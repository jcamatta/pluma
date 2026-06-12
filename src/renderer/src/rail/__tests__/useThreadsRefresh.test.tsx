// useThreadsRefresh subscribes to the agent and invalidates the workspace's ['threads', cwd] query when
// a run finalizes, so a newly created thread shows up in the list. A fake AbstractAgent captures the
// subscriber and lets the test trigger onRunFinalized — no IPC.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import type { BaseEvent } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { threadsKey } from '../../threads/threadKeys'
import { useThreadsRefresh } from '../useThreadsRefresh'

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

  finalize(): void {
    void this.sub?.onRunFinalized?.({
      messages: [],
      state: {},
      agent: this,
      input: {
        threadId: '',
        runId: '',
        messages: [],
        tools: [],
        context: [],
        forwardedProps: {},
        state: {}
      }
    })
  }
}

describe('useThreadsRefresh', () => {
  it('invalidates the threads query when a run finalizes', () => {
    const agent = new FakeAgent()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(() => useThreadsRefresh(agent, '/work'), { wrapper })

    agent.finalize()

    expect(invalidate).toHaveBeenCalledWith({ queryKey: threadsKey('/work') })
  })
})
