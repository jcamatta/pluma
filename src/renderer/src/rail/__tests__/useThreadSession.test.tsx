// useThreadSession against an in-memory threads repo + a spy ThreadControls: selecting a thread loads its
// history and seeds the agent with it once, tracking it as active and returning to chat; starting a new
// thread clears the selection and resets the agent; the view toggles between chat and the threads list.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Message } from '@ag-ui/core'
import { ThreadControlsContext } from '../../agent/ThreadControlsContext'
import type { ThreadControls } from '../../agent/ThreadControlsContext'
import { ThreadsContext } from '../../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../../threads/__tests__/fake-threads-repository'
import { useThreadSession } from '../useThreadSession'

type Session = ReturnType<typeof useThreadSession>

const history: readonly Message[] = [
  { id: 'm1', role: 'user', content: 'hi' },
  { id: 'm2', role: 'assistant', content: 'hello' }
]

function renderSession(controls: ThreadControls): ReturnType<typeof renderHook<Session, void>> {
  const repos = createFakeThreadsRepository({ history })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <ThreadsContext.Provider value={repos}>
        <ThreadControlsContext.Provider value={controls}>{children}</ThreadControlsContext.Provider>
      </ThreadsContext.Provider>
    </QueryClientProvider>
  )
  return renderHook(() => useThreadSession('/work'), { wrapper })
}

describe('useThreadSession', () => {
  it('seeds the agent with the selected thread history and tracks it as active', async () => {
    const controls: ThreadControls = { seedThread: vi.fn(), newThread: vi.fn() }
    const { result } = renderSession(controls)

    act(() => result.current.showThreads())
    expect(result.current.view).toBe('threads')

    act(() => result.current.select('s1'))
    expect(result.current.selectedId).toBe('s1')
    expect(result.current.view).toBe('chat')
    await waitFor(() => expect(controls.seedThread).toHaveBeenCalledWith('s1', history))
  })

  it('clears the selection and resets the agent on a new thread', () => {
    const controls: ThreadControls = { seedThread: vi.fn(), newThread: vi.fn() }
    const { result } = renderSession(controls)

    act(() => result.current.select('s1'))
    act(() => result.current.startNew())
    expect(controls.newThread).toHaveBeenCalledTimes(1)
    expect(result.current.selectedId).toBeNull()
  })
})
