// useDeleteEntry against an in-memory fake repository: a file deletes through the fileWriter's
// deleteFile, a directory through deleteFolder, and a successful delete invalidates the parent folder's
// ['folder', parent] listing so the entry disappears. A failed delete leaves the listing untouched. The
// fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { RepositoriesContext } from '../RepositoriesContext'
import { useDeleteEntry } from '../useDeleteEntry'
import type { DeleteVariables } from '../useDeleteEntry'
import { folderListingKey } from '../folder-query-keys'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'

// A harness that exposes its QueryClient so a test can prime a listing query and observe whether a
// delete invalidated (refetched) it.
function renderWithClient(repos: FakeRepository): {
  readonly result: ReturnType<typeof renderHook<ReturnType<typeof useDeleteEntry>, void>>['result']
  readonly queryClient: QueryClient
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  const { result } = renderHook(() => useDeleteEntry(), { wrapper })
  return { result, queryClient }
}

describe('useDeleteEntry', () => {
  it('deletes a file through the file writer port', async () => {
    const repos = createFakeFolderRepository({})
    const deleteFileSpy = vi.spyOn(repos.writer, 'deleteFile')
    const deleteFolderSpy = vi.spyOn(repos.writer, 'deleteFolder')
    const { result } = renderWithClient(repos)

    const variables: DeleteVariables = { type: 'file', path: '/root/a.md', parent: '/root' }
    const outcome = await result.current.remove(variables)

    expect(outcome).toEqual({ ok: true, value: '/root/a.md' })
    expect(deleteFileSpy).toHaveBeenCalledWith('/root/a.md')
    expect(deleteFolderSpy).not.toHaveBeenCalled()
    expect(repos.deleted()).toEqual(['/root/a.md'])
  })

  it('deletes a directory through the folder writer port', async () => {
    const repos = createFakeFolderRepository({})
    const deleteFileSpy = vi.spyOn(repos.writer, 'deleteFile')
    const deleteFolderSpy = vi.spyOn(repos.writer, 'deleteFolder')
    const { result } = renderWithClient(repos)

    const variables: DeleteVariables = { type: 'directory', path: '/root/sub', parent: '/root' }
    const outcome = await result.current.remove(variables)

    expect(outcome).toEqual({ ok: true, value: '/root/sub' })
    expect(deleteFolderSpy).toHaveBeenCalledWith('/root/sub')
    expect(deleteFileSpy).not.toHaveBeenCalled()
    expect(repos.deleted()).toEqual(['/root/sub'])
  })

  it('invalidates the parent folder listing after a successful delete', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const listSpy = vi.spyOn(repos.reader, 'list')

    // Render the delete hook alongside an active listing query for the parent. invalidateQueries only
    // refetches active (observed) queries, so the listing must have a live observer for the refetch to
    // be visible.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>
        </I18nextProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({
        del: useDeleteEntry(),
        listing: useQuery({
          queryKey: folderListingKey('/root'),
          queryFn: () => repos.reader.list('/root')
        })
      }),
      { wrapper }
    )

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))

    await result.current.del.remove({ type: 'file', path: '/root/a.md', parent: '/root' })

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(2)
    })
  })
})
