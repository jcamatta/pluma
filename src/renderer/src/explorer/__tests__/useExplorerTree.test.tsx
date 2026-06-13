// useExplorerTree against an in-memory fake repository: it builds the lazily-loaded tree from the open
// set + folder listings, toggles a folder open/closed, drives the draft → create flow (selecting only a
// newly created file), and routes a delete through the command hook with the type resolved from the tree
// and the parent constrained to the root. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useExplorerTree } from '../useExplorerTree'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'
import { ReposHarness } from './render-with-repos'

type TreeOptions = {
  readonly repos: FakeRepository
  readonly root?: string
  readonly selected?: string | null
  readonly onSelect?: (path: string) => void
}

function renderTree(
  options: TreeOptions
): ReturnType<typeof renderHook<ReturnType<typeof useExplorerTree>, void>> {
  const { repos, root = '/root', selected = null, onSelect = (): void => {} } = options
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ReposHarness repos={repos}>{children}</ReposHarness>
  )
  return renderHook(() => useExplorerTree(root, { selected, onSelect }), { wrapper })
}

function treeNames(tree: ReturnType<typeof useExplorerTree>['tree']): readonly string[] {
  return tree.map((node) => node.name)
}

function isOpen(tree: ReturnType<typeof useExplorerTree>['tree'], path: string): boolean {
  return tree.find((node) => node.path === path)?.open === true
}

describe('useExplorerTree read side', () => {
  it('builds the root listing into the tree', async () => {
    const repos = createFakeFolderRepository({
      '/root': [
        { name: 'a.md', type: 'file' },
        { name: 'sub', type: 'directory' }
      ]
    })
    const { result } = renderTree({ repos })

    // buildTree orders directories before files, so 'sub' sorts ahead of 'a.md'.
    await waitFor(() => expect(treeNames(result.current.tree)).toEqual(['sub', 'a.md']))
  })

  it('toggles a folder open and lists its children', async () => {
    const repos = createFakeFolderRepository({
      '/root': [{ name: 'sub', type: 'directory' }],
      '/root/sub': [{ name: 'inner.md', type: 'file' }]
    })
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.toggle('/root/sub'))

    const loaded = (): boolean =>
      result.current.tree.some((node) => node.path === '/root/sub' && node.children !== undefined)
    await waitFor(() => expect(loaded()).toBe(true))

    const sub = result.current.tree.find((node) => node.path === '/root/sub')
    expect(sub?.children?.map((child) => child.name)).toEqual(['inner.md'])
  })
})

describe('useExplorerTree draft → create', () => {
  it('selects a newly created file after committing its draft', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const onSelect = vi.fn()
    const { result } = renderTree({ repos, onSelect })

    act(() => result.current.beginCreate('file', null))
    expect(result.current.draft).toEqual({ parentPath: null, type: 'file' })

    await act(async () => {
      result.current.commitDraft('new.md')
    })

    await waitFor(() => expect(repos.created()).toEqual(['/root/new.md']))
    expect(onSelect).toHaveBeenCalledWith('/root/new.md')
    expect(result.current.draft).toBeNull()
  })

  it('sends the typed name as-is and selects the .md path the backend returns', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const onSelect = vi.fn()
    const { result } = renderTree({ repos, onSelect })

    act(() => result.current.beginCreate('file', null))
    await act(async () => {
      result.current.commitDraft('draft')
    })

    // The renderer no longer appends .md; the backend (fake) normalizes and returns /root/draft.md,
    // and the new file is selected by that returned path, not the raw name the renderer sent.
    await waitFor(() => expect(repos.created()).toEqual(['/root/draft.md']))
    expect(onSelect).toHaveBeenCalledWith('/root/draft.md')
  })

  it('creates a folder without selecting it', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const onSelect = vi.fn()
    const { result } = renderTree({ repos, onSelect })

    act(() => result.current.beginCreate('directory', null))
    await act(async () => {
      result.current.commitDraft('sub')
    })

    await waitFor(() => expect(repos.created()).toEqual(['/root/sub']))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('opens a closed folder so its draft row is visible', async () => {
    const repos = createFakeFolderRepository({
      '/root': [{ name: 'sub', type: 'directory' }],
      '/root/sub': [{ name: 'inner.md', type: 'file' }]
    })
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginCreate('file', '/root/sub'))

    expect(result.current.draft).toEqual({ parentPath: '/root/sub', type: 'file' })
    await waitFor(() => expect(isOpen(result.current.tree, '/root/sub')).toBe(true))
  })

  it('cancels an empty draft name without creating', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const { result } = renderTree({ repos })

    act(() => result.current.beginCreate('file', null))
    await act(async () => {
      result.current.commitDraft('')
    })

    expect(repos.created()).toEqual([])
    expect(result.current.draft).toBeNull()
  })

  it('cancelDraft clears the draft', () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const { result } = renderTree({ repos })

    act(() => result.current.beginCreate('file', null))
    expect(result.current.draft).not.toBeNull()

    act(() => result.current.cancelDraft())
    expect(result.current.draft).toBeNull()
  })
})

describe('useExplorerTree delete', () => {
  it('deletes a folder with the type resolved from the tree', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'sub', type: 'directory' }] })
    const deleteFolderSpy = vi.spyOn(repos.writer, 'deleteFolder')
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    await act(async () => {
      result.current.remove('/root/sub')
    })

    await waitFor(() => expect(repos.deleted()).toEqual(['/root/sub']))
    expect(deleteFolderSpy).toHaveBeenCalledWith('/root/sub')
  })

  it('deletes a file, falling back to the file type and the root as parent', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'a.md', type: 'file' }] })
    const deleteFileSpy = vi.spyOn(repos.writer, 'deleteFile')
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    await act(async () => {
      result.current.remove('/root/a.md')
    })

    await waitFor(() => expect(repos.deleted()).toEqual(['/root/a.md']))
    expect(deleteFileSpy).toHaveBeenCalledWith('/root/a.md')
  })
})

describe('useExplorerTree rename', () => {
  it('renames a folder in place and clears the renaming state', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'draft', type: 'directory' }] })
    const renameSpy = vi.spyOn(repos.writer, 'renameFolder')
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginRename('/root/draft'))
    expect(result.current.renamingPath).toBe('/root/draft')

    await act(async () => {
      result.current.commitRename('final')
    })

    await waitFor(() =>
      expect(repos.renamed()).toEqual([{ from: '/root/draft', to: '/root/final' }])
    )
    expect(renameSpy).toHaveBeenCalledWith('/root/draft', '/root/final')
    expect(result.current.renamingPath).toBeNull()
  })

  it('renames a file with the type resolved from the tree and follows the selection', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'old.md', type: 'file' }] })
    const renameFileSpy = vi.spyOn(repos.writer, 'renameFile')
    const onSelect = vi.fn()
    const { result } = renderTree({ repos, selected: '/root/old.md', onSelect })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginRename('/root/old.md'))
    await act(async () => {
      result.current.commitRename('new.md')
    })

    expect(renameFileSpy).toHaveBeenCalledWith('/root/old.md', '/root/new.md')
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('/root/new.md'))
    expect(result.current.renamingPath).toBeNull()
  })

  it('remaps the selected file under the renamed folder', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'draft', type: 'directory' }] })
    const onSelect = vi.fn()
    const { result } = renderTree({ repos, selected: '/root/draft/ch1.md', onSelect })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginRename('/root/draft'))
    await act(async () => {
      result.current.commitRename('final')
    })

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('/root/final/ch1.md'))
  })

  it('does not call rename for an unchanged name', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'draft', type: 'directory' }] })
    const renameSpy = vi.spyOn(repos.writer, 'renameFolder')
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginRename('/root/draft'))
    await act(async () => {
      result.current.commitRename('draft')
    })

    expect(renameSpy).not.toHaveBeenCalled()
    expect(result.current.renamingPath).toBeNull()
  })

  it('cancelRename clears the renaming state without renaming', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'draft', type: 'directory' }] })
    const renameSpy = vi.spyOn(repos.writer, 'renameFolder')
    const { result } = renderTree({ repos })
    await waitFor(() => expect(result.current.tree).toHaveLength(1))

    act(() => result.current.beginRename('/root/draft'))
    act(() => result.current.cancelRename())

    expect(result.current.renamingPath).toBeNull()
    expect(renameSpy).not.toHaveBeenCalled()
  })
})
