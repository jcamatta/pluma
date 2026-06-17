// ExplorerView is pure: it renders the tree from props and fires callbacks on interaction. No IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExplorerView } from '../Explorer.view'
import type { ExplorerLabels, TreeNodeModel } from '../explorer-view-types'

const labels: ExplorerLabels = {
  title: 'Files',
  newFile: 'New file',
  newFolder: 'New folder',
  deleteFile: 'Delete file',
  deleteFolder: 'Delete folder',
  renameFile: 'Rename file',
  renameFolder: 'Rename folder',
  collapse: 'Collapse files',
  untitled: 'Untitled',
  empty: 'No files yet.',
  loading: 'Loading files…'
}

const noop = (): void => undefined

const emptyTree: readonly TreeNodeModel[] = []

const baseProps = {
  labels,
  tree: emptyTree,
  isLoading: false,
  selected: null,
  draft: null,
  renamingPath: null,
  onClose: noop,
  onSelect: noop,
  onToggle: noop,
  onCreate: () => undefined,
  onDelete: noop,
  onCommitDraft: noop,
  onCancelDraft: noop,
  onStartRename: noop,
  onCommitRename: noop,
  onCancelRename: noop
}

describe('ExplorerView', () => {
  it('shows the empty message when there are no nodes and no draft', () => {
    render(<ExplorerView {...baseProps} />)
    expect(screen.getByText('No files yet.')).toBeInTheDocument()
  })

  it('renders folders and files and selects a file on click', () => {
    const onSelect = vi.fn()
    const tree: readonly TreeNodeModel[] = [
      { path: '/r/dir', name: 'dir', type: 'directory', open: false, children: undefined },
      { path: '/r/a.md', name: 'a.md', type: 'file' }
    ]
    render(<ExplorerView {...baseProps} tree={tree} onSelect={onSelect} />)

    expect(screen.getByText('dir')).toBeInTheDocument()
    fireEvent.click(screen.getByText('a.md'))
    expect(onSelect).toHaveBeenCalledWith('/r/a.md')
  })

  it('toggles a folder open on click', () => {
    const onToggle = vi.fn()
    const tree: readonly TreeNodeModel[] = [
      { path: '/r/dir', name: 'dir', type: 'directory', open: false, children: undefined }
    ]
    render(<ExplorerView {...baseProps} tree={tree} onToggle={onToggle} />)
    fireEvent.click(screen.getByText('dir'))
    expect(onToggle).toHaveBeenCalledWith('/r/dir')
  })

  it('renders children of an open folder', () => {
    const tree: readonly TreeNodeModel[] = [
      {
        path: '/r/dir',
        name: 'dir',
        type: 'directory',
        open: true,
        children: [{ path: '/r/dir/c.md', name: 'c.md', type: 'file' }]
      }
    ]
    render(<ExplorerView {...baseProps} tree={tree} />)
    expect(screen.getByText('c.md')).toBeInTheDocument()
  })

  it('fires onCreate from the header new-file button', () => {
    const onCreate = vi.fn()
    render(<ExplorerView {...baseProps} onCreate={onCreate} />)
    fireEvent.click(screen.getAllByLabelText('New file')[0])
    expect(onCreate).toHaveBeenCalledWith('file', null)
  })

  it('commits a draft name on Enter', () => {
    const onCommitDraft = vi.fn()
    render(
      <ExplorerView
        {...baseProps}
        draft={{ parentPath: null, type: 'file' }}
        onCommitDraft={onCommitDraft}
      />
    )
    const input = screen.getByPlaceholderText('Untitled')
    fireEvent.change(input, { target: { value: 'chapter.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommitDraft).toHaveBeenCalledWith('chapter.md')
  })

  it('cancels a draft on Escape', () => {
    const onCancelDraft = vi.fn()
    render(
      <ExplorerView
        {...baseProps}
        draft={{ parentPath: null, type: 'file' }}
        onCancelDraft={onCancelDraft}
      />
    )
    fireEvent.keyDown(screen.getByPlaceholderText('Untitled'), { key: 'Escape' })
    expect(onCancelDraft).toHaveBeenCalled()
  })
})

describe('ExplorerView loading', () => {
  it('shows the loading skeleton instead of the empty message while loading', () => {
    render(<ExplorerView {...baseProps} isLoading />)
    expect(screen.getByRole('status', { name: 'Loading files…' })).toBeInTheDocument()
    expect(screen.queryByText('No files yet.')).not.toBeInTheDocument()
  })
})

describe('ExplorerView rename', () => {
  it('starts a folder rename from the row action', () => {
    const onStartRename = vi.fn()
    const tree: readonly TreeNodeModel[] = [
      { path: '/r/dir', name: 'dir', type: 'directory', open: false, children: undefined }
    ]
    render(<ExplorerView {...baseProps} tree={tree} onStartRename={onStartRename} />)

    fireEvent.click(screen.getByLabelText('Rename folder'))
    expect(onStartRename).toHaveBeenCalledWith('/r/dir')
  })

  it('shows the inline name field pre-filled and commits on Enter while renaming', () => {
    const onCommitRename = vi.fn()
    const tree: readonly TreeNodeModel[] = [
      { path: '/r/dir', name: 'dir', type: 'directory', open: false, children: undefined }
    ]
    render(
      <ExplorerView
        {...baseProps}
        tree={tree}
        renamingPath="/r/dir"
        onCommitRename={onCommitRename}
      />
    )

    const input = screen.getByDisplayValue('dir')
    fireEvent.change(input, { target: { value: 'renamed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommitRename).toHaveBeenCalledWith('renamed')
  })

  it('starts a file rename from the row action', () => {
    const onStartRename = vi.fn()
    const tree: readonly TreeNodeModel[] = [{ path: '/r/a.md', name: 'a.md', type: 'file' }]
    render(<ExplorerView {...baseProps} tree={tree} onStartRename={onStartRename} />)

    fireEvent.click(screen.getByLabelText('Rename file'))
    expect(onStartRename).toHaveBeenCalledWith('/r/a.md')
  })

  it('shows the inline name field pre-filled with the file name while renaming', () => {
    const onCommitRename = vi.fn()
    const tree: readonly TreeNodeModel[] = [{ path: '/r/a.md', name: 'a.md', type: 'file' }]
    render(
      <ExplorerView
        {...baseProps}
        tree={tree}
        renamingPath="/r/a.md"
        onCommitRename={onCommitRename}
      />
    )

    const input = screen.getByDisplayValue('a.md')
    fireEvent.change(input, { target: { value: 'b.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommitRename).toHaveBeenCalledWith('b.md')
  })
})
