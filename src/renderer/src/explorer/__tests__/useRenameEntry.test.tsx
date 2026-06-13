// useRenameEntry against an in-memory fake repository: a rename goes through the writer's renameFolder,
// and a successful rename invalidates the parent folder's ['folder', parent] listing so the row
// re-lists with the new name. A failed rename (ok: false) leaves the listing untouched. The fake is the
// single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { RepositoriesContext } from '../RepositoriesContext'
import { useRenameEntry } from '../useRenameEntry'
import { folderListingKey } from '../folder-query-keys'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'

function renderWithListing(repos: FakeRepository): {
  readonly result: ReturnType<
    typeof renderHook<
      { readonly ren: ReturnType<typeof useRenameEntry>; readonly listing: unknown },
      void
    >
  >['result']
  readonly listSpy: ReturnType<typeof vi.spyOn>
} {
  const listSpy = vi.spyOn(repos.reader, 'list')
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
      ren: useRenameEntry(),
      listing: useQuery({
        queryKey: folderListingKey('/root'),
        queryFn: () => repos.reader.list('/root')
      })
    }),
    { wrapper }
  )
  return { result, listSpy }
}

describe('useRenameEntry', () => {
  it('renames a folder through the writer port and returns the new path', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const renameSpy = vi.spyOn(repos.writer, 'renameFolder')
    const { result } = renderWithListing(repos)

    const outcome = await result.current.ren.rename({
      type: 'directory',
      oldPath: '/root/draft',
      newPath: '/root/final',
      parent: '/root'
    })

    expect(outcome).toEqual({ ok: true, value: '/root/final' })
    expect(renameSpy).toHaveBeenCalledWith('/root/draft', '/root/final')
    expect(repos.renamed()).toEqual([{ from: '/root/draft', to: '/root/final' }])
  })

  it('renames a file through the writer port and returns the new path', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const renameFileSpy = vi.spyOn(repos.writer, 'renameFile')
    const renameFolderSpy = vi.spyOn(repos.writer, 'renameFolder')
    const { result } = renderWithListing(repos)

    const outcome = await result.current.ren.rename({
      type: 'file',
      oldPath: '/root/old.md',
      newPath: '/root/new.md',
      parent: '/root'
    })

    expect(outcome).toEqual({ ok: true, value: '/root/new.md' })
    expect(renameFileSpy).toHaveBeenCalledWith('/root/old.md', '/root/new.md')
    expect(renameFolderSpy).not.toHaveBeenCalled()
  })

  it('invalidates the parent folder listing after a successful rename', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const { result, listSpy } = renderWithListing(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))

    await result.current.ren.rename({
      type: 'directory',
      oldPath: '/root/draft',
      newPath: '/root/final',
      parent: '/root'
    })

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2))
  })

  it('does not invalidate the listing when the rename fails', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    vi.spyOn(repos.writer, 'renameFolder').mockResolvedValue({
      ok: false,
      error: { _tag: 'FolderAlreadyExists', path: '/root/final' }
    })
    const { result, listSpy } = renderWithListing(repos)

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(1))

    const outcome = await result.current.ren.rename({
      type: 'directory',
      oldPath: '/root/draft',
      newPath: '/root/final',
      parent: '/root'
    })

    expect(outcome).toEqual({
      ok: false,
      error: { _tag: 'FolderAlreadyExists', path: '/root/final' }
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listSpy).toHaveBeenCalledTimes(1)
  })
})
