// useThreadHistory against an in-memory fake repository: the hook is disabled until a thread is
// selected (id null), then resolves the IPC Result of that thread's messages. Reads through the reader
// port (no window.api). The fake is the single seam.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Message } from '@ag-ui/core'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { useThreadHistory } from '../useThreadHistory'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderWithRepos(
  repos: ThreadsRepositories,
  id: string | null
): ReturnType<typeof renderHook<ReturnType<typeof useThreadHistory>, void>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
    </QueryClientProvider>
  )
  return renderHook(() => useThreadHistory('/work', id), { wrapper })
}

const history: readonly Message[] = [{ id: 'm1', role: 'user', content: 'hi' }]

describe('useThreadHistory', () => {
  it('stays idle while no thread is selected', () => {
    const repos = createFakeThreadsRepository({ history })
    const { result } = renderWithRepos(repos, null)

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('resolves the selected thread history as an ok Result', async () => {
    const repos = createFakeThreadsRepository({ history })
    const { result } = renderWithRepos(repos, 's1')

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toEqual({ ok: true, value: history })
  })
})
