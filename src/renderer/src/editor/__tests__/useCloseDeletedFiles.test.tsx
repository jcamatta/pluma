import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'
import { OpenFilesContext } from '../OpenFilesContext'
import type { OpenFilesNav } from '../OpenFilesContext'
import { useCloseDeletedFiles } from '../useCloseDeletedFiles'

describe('useCloseDeletedFiles', () => {
  it('closes a file when the watcher reports it was deleted', () => {
    const repos = createFakeFolderRepository({})
    const closed: string[] = []
    const nav: OpenFilesNav = {
      activePath: '/a.md',
      open: () => undefined,
      openInBackground: () => undefined,
      close: (path) => closed.push(path)
    }
    function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
      return (
        <ReposHarness repos={repos}>
          <OpenFilesContext.Provider value={nav}>{children}</OpenFilesContext.Provider>
        </ReposHarness>
      )
    }
    renderHook(() => useCloseDeletedFiles(), { wrapper })

    repos.emit({ type: 'deleted', path: '/a.md' })

    expect(closed).toEqual(['/a.md'])
  })

  it('ignores created and updated changes', () => {
    const repos = createFakeFolderRepository({})
    const closed: string[] = []
    const nav: OpenFilesNav = {
      activePath: '/a.md',
      open: () => undefined,
      openInBackground: () => undefined,
      close: (path) => closed.push(path)
    }
    function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
      return (
        <ReposHarness repos={repos}>
          <OpenFilesContext.Provider value={nav}>{children}</OpenFilesContext.Provider>
        </ReposHarness>
      )
    }
    renderHook(() => useCloseDeletedFiles(), { wrapper })

    repos.emit({ type: 'created', path: '/b.md' })
    repos.emit({ type: 'updated', path: '/a.md' })

    expect(closed).toEqual([])
  })

  it('unsubscribes from the watcher on unmount', () => {
    const repos = createFakeFolderRepository({})
    const closed: string[] = []
    const nav: OpenFilesNav = {
      activePath: '/a.md',
      open: () => undefined,
      openInBackground: () => undefined,
      close: (path) => closed.push(path)
    }
    function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
      return (
        <ReposHarness repos={repos}>
          <OpenFilesContext.Provider value={nav}>{children}</OpenFilesContext.Provider>
        </ReposHarness>
      )
    }
    const { unmount } = renderHook(() => useCloseDeletedFiles(), { wrapper })

    unmount()
    repos.emit({ type: 'deleted', path: '/a.md' })

    expect(closed).toEqual([])
  })
})
