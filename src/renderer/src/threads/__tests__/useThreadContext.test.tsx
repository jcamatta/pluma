// useThreadContext against an in-memory fake repository: disabled until a thread is selected, then
// resolves the IPC Result of that thread's context usage. Reads through the reader port (no window.api).

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AgentContextUsage } from '../../../../shared/agent/context-usage'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { useThreadContext } from '../useThreadContext'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderWithRepos(
  repos: ThreadsRepositories,
  id: string | null
): ReturnType<typeof renderHook<ReturnType<typeof useThreadContext>, void>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
    </QueryClientProvider>
  )
  return renderHook(() => useThreadContext('/work', id), { wrapper })
}

const context: AgentContextUsage = {
  usedTokens: 60_000,
  windowTokens: 1_000_000,
  breakdown: { inputTokens: 5000, cacheReadTokens: 55_000, cacheCreationTokens: 0 }
}

describe('useThreadContext', () => {
  it('stays idle while no thread is selected', () => {
    const { result } = renderWithRepos(createFakeThreadsRepository({ context }), null)

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('resolves the selected thread context as an ok Result', async () => {
    const { result } = renderWithRepos(createFakeThreadsRepository({ context }), 's1')

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({ ok: true, value: context })
  })
})
