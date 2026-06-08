// ExplorerController + useExplorerTree against an in-memory fake repository: it lists the root on mount,
// lazily lists a folder when opened, re-lists on a folder:changed event, and creates a file through the
// writer port then selects it. The fake is the single seam — no window.api, no Electron.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExplorerController } from '../Explorer.controller'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'
import { ReposHarness } from './render-with-repos'

type SelectMock = ReturnType<typeof vi.fn<(path: string) => void>>

function renderController(
  repos: FakeRepository,
  onSelect: SelectMock = vi.fn<(path: string) => void>()
): { readonly onSelect: SelectMock } {
  render(
    <ReposHarness repos={repos}>
      <ExplorerController root="/root" selected={null} onSelect={onSelect} onClose={vi.fn()} />
    </ReposHarness>
  )
  return { onSelect }
}

describe('ExplorerController', () => {
  it('lists the root on mount', async () => {
    const repos = createFakeFolderRepository({
      '/root': [
        { name: 'dir', type: 'directory' },
        { name: 'a.md', type: 'file' }
      ]
    })
    renderController(repos)
    expect(await screen.findByText('dir')).toBeInTheDocument()
    expect(screen.getByText('a.md')).toBeInTheDocument()
  })

  it('lazily lists a folder when it is opened', async () => {
    const repos = createFakeFolderRepository({
      '/root': [{ name: 'dir', type: 'directory' }],
      '/root/dir': [{ name: 'child.md', type: 'file' }]
    })
    renderController(repos)

    fireEvent.click(await screen.findByText('dir'))
    expect(await screen.findByText('child.md')).toBeInTheDocument()
  })

  it('re-lists on a folder:changed event', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'a.md', type: 'file' }] })
    const listSpy = vi.spyOn(repos.reader, 'list')
    renderController(repos)
    await screen.findByText('a.md')
    const before = listSpy.mock.calls.length

    repos.emit({ type: 'created', path: '/root/b.md' })

    await waitFor(() => {
      expect(listSpy.mock.calls.length).toBeGreaterThan(before)
    })
  })

  it('creates a file through the writer and selects it', async () => {
    const repos = createFakeFolderRepository({ '/root': [] })
    const { onSelect } = renderController(repos)

    fireEvent.click(await screen.findByLabelText('New file'))
    const input = await screen.findByPlaceholderText('Untitled')
    fireEvent.change(input, { target: { value: 'new.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(repos.created()).toContain('/root/new.md')
    })
    expect(onSelect).toHaveBeenCalledWith('/root/new.md')
  })
})
