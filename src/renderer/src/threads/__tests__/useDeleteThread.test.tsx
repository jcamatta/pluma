// useDeleteThread against an in-memory fake repository: a delete goes through the writer port and, on
// success, invalidates the ['threads', cwd] listing so the row disappears; a failed delete leaves the
// listing untouched. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { useDeleteThread } from '../useDeleteThread'
import { threadsKey } from '../threadKeys'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderDelete(repos: ThreadsRepositories): {
  readonly result: ReturnType<
    typeof renderHook<
      { del: ReturnType<typeof useDeleteThread>; listing: ReturnType<typeof useQuery> },
      void
    >
  >['result']
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
    </QueryClientProvider>
  )
  const { result } = renderHook(
    () => ({
      del: useDeleteThread(),
      listing: useQuery({
        queryKey: threadsKey('/work'),
        queryFn: () => repos.reader.listThreads('/work')
      })
    }),
    { wrapper }
  )
  return { result }
}

describe('useDeleteThread', () => {
  it('deletes through the writer port and refetches the listing on success', async () => {
    const repos = createFakeThreadsRepository({ threads: [] })
    const deleteSpy = vi.spyOn(repos.writer, 'deleteThread')
    const listSpy = vi.spyOn(repos.reader, 'listThreads')
    const { result } = renderDelete(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))
    const outcome = await result.current.del.remove({ cwd: '/work', id: 's1' })

    expect(outcome).toEqual({ ok: true, value: null })
    expect(deleteSpy).toHaveBeenCalledWith('/work', 's1')
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
  })

  it('does not refetch the listing when the delete fails', async () => {
    const repos = createFakeThreadsRepository({ threads: [] })
    vi.spyOn(repos.writer, 'deleteThread').mockResolvedValue({
      ok: false,
      error: { _tag: 'ThreadWriteFailed' }
    })
    const listSpy = vi.spyOn(repos.reader, 'listThreads')
    const { result } = renderDelete(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))
    const outcome = await result.current.del.remove({ cwd: '/work', id: 's1' })

    expect(outcome).toEqual({ ok: false, error: { _tag: 'ThreadWriteFailed' } })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listSpy).toHaveBeenCalledTimes(1)
  })
})
