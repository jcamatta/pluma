// useRenameThread against an in-memory fake repository: a rename goes through the writer port and, on
// success, invalidates the ['threads', cwd] listing so the new title is refetched; a failed rename leaves
// the listing untouched. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { useRenameThread } from '../useRenameThread'
import { threadsKey } from '../threadKeys'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderRename(repos: ThreadsRepositories): {
  readonly result: ReturnType<
    typeof renderHook<
      { rename: ReturnType<typeof useRenameThread>; listing: ReturnType<typeof useQuery> },
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
      rename: useRenameThread(),
      listing: useQuery({
        queryKey: threadsKey('/work'),
        queryFn: () => repos.reader.listThreads('/work')
      })
    }),
    { wrapper }
  )
  return { result }
}

describe('useRenameThread', () => {
  it('renames through the writer port and refetches the listing on success', async () => {
    const repos = createFakeThreadsRepository({ threads: [] })
    const renameSpy = vi.spyOn(repos.writer, 'renameThread')
    const listSpy = vi.spyOn(repos.reader, 'listThreads')
    const { result } = renderRename(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))
    const outcome = await result.current.rename.rename({
      cwd: '/work',
      id: 's1',
      title: 'New title'
    })

    expect(outcome).toEqual({ ok: true, value: null })
    expect(renameSpy).toHaveBeenCalledWith({ cwd: '/work', id: 's1', title: 'New title' })
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
  })

  it('does not refetch the listing when the rename fails', async () => {
    const repos = createFakeThreadsRepository({ threads: [] })
    vi.spyOn(repos.writer, 'renameThread').mockResolvedValue({
      ok: false,
      error: { _tag: 'ThreadWriteFailed' }
    })
    const listSpy = vi.spyOn(repos.reader, 'listThreads')
    const { result } = renderRename(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))
    const outcome = await result.current.rename.rename({ cwd: '/work', id: 's1', title: 'x' })

    expect(outcome).toEqual({ ok: false, error: { _tag: 'ThreadWriteFailed' } })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listSpy).toHaveBeenCalledTimes(1)
  })
})
