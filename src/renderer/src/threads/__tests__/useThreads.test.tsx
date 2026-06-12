// useThreads against an in-memory fake repository: the hook resolves the IPC Result of the workspace's
// thread summaries, and reads through the reader port (no window.api). The fake is the single seam.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ThreadSummary } from '../../../../shared/ipc/ipc-contract/agent'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { useThreads } from '../useThreads'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderWithRepos(
  repos: ThreadsRepositories
): ReturnType<typeof renderHook<ReturnType<typeof useThreads>, void>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
    </QueryClientProvider>
  )
  return renderHook(() => useThreads('/work'), { wrapper })
}

const threads: readonly ThreadSummary[] = [{ id: 's1', title: 'First', updatedAt: 2 }]

describe('useThreads', () => {
  it('resolves the workspace thread summaries as an ok Result', async () => {
    const repos = createFakeThreadsRepository({ threads })
    const { result } = renderWithRepos(repos)

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({ ok: true, value: threads })
  })
})
