// ThreadsPanelView is pure: it renders the thread rows from props, shows an empty state when there are
// none, highlights the active row, exposes rename (inline field) and delete affordances per row, and
// fires its callbacks on interaction. The delete dialog renders when deleteOpen is set. No IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThreadsPanelView } from '../ThreadsPanel.view'
import type { ThreadRow, ThreadsPanelLabels } from '../ThreadsPanel.view'
import type { ThreadDeleteDialogLabels } from '../ThreadDeleteDialog'

const labels: ThreadsPanelLabels = {
  title: 'Chats',
  newThread: 'New chat',
  back: 'Back',
  empty: 'No chats yet.',
  rename: 'Rename',
  delete: 'Delete'
}

const deleteLabels: ThreadDeleteDialogLabels = {
  title: 'Delete chat?',
  message: 'It will be deleted.',
  confirm: 'Delete',
  cancel: 'Cancel'
}

const noop = (): void => undefined

const emptyRows: readonly ThreadRow[] = []

const baseProps = {
  labels,
  rows: emptyRows,
  editingId: null,
  deleteOpen: false,
  deleteLabels,
  onSelect: noop,
  onNewThread: noop,
  onBack: noop,
  onStartRename: noop,
  onCommitRename: noop,
  onCancelRename: noop,
  onRequestDelete: noop,
  onConfirmDelete: noop,
  onCancelDelete: noop
}

const rows: readonly ThreadRow[] = [
  { id: 's1', title: 'Draft review', subtitle: '2 hours ago', active: false },
  { id: 's2', title: 'Outline', subtitle: 'yesterday', active: true }
]

describe('ThreadsPanelView', () => {
  it('shows the empty message when there are no threads', () => {
    render(<ThreadsPanelView {...baseProps} />)
    expect(screen.getByText('No chats yet.')).toBeInTheDocument()
  })

  it('renders a row per thread with its title and subtitle', () => {
    render(<ThreadsPanelView {...baseProps} rows={rows} />)
    expect(screen.getByText('Draft review')).toBeInTheDocument()
    expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    expect(screen.getByText('Outline')).toBeInTheDocument()
  })

  it('fires onSelect with the row id when a row is clicked', () => {
    const onSelect = vi.fn()
    render(<ThreadsPanelView {...baseProps} rows={rows} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('thread-row:s1'))
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('fires onNewThread and onBack from the header buttons', () => {
    const onNewThread = vi.fn()
    const onBack = vi.fn()
    render(<ThreadsPanelView {...baseProps} onNewThread={onNewThread} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onNewThread).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('fires onStartRename and onRequestDelete from a row without selecting it', () => {
    const onSelect = vi.fn()
    const onStartRename = vi.fn()
    const onRequestDelete = vi.fn()
    render(
      <ThreadsPanelView
        {...baseProps}
        rows={rows}
        onSelect={onSelect}
        onStartRename={onStartRename}
        onRequestDelete={onRequestDelete}
      />
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(onStartRename).toHaveBeenCalledWith('s1')
    expect(onRequestDelete).toHaveBeenCalledWith('s1')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('hides the row actions while a row is being edited', () => {
    const oneRow: readonly ThreadRow[] = [
      { id: 's1', title: 'Draft review', subtitle: '2 hours ago', active: true }
    ]
    render(<ThreadsPanelView {...baseProps} rows={oneRow} editingId="s1" />)
    expect(screen.getByDisplayValue('Draft review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows an inline title field and commits the new title on Enter', () => {
    const onCommitRename = vi.fn()
    render(
      <ThreadsPanelView {...baseProps} rows={rows} editingId="s1" onCommitRename={onCommitRename} />
    )
    const field = screen.getByDisplayValue('Draft review')
    fireEvent.change(field, { target: { value: 'Renamed' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onCommitRename).toHaveBeenCalledWith('s1', 'Renamed')
  })

  it('renders the delete confirm dialog and fires onConfirmDelete', () => {
    const onConfirmDelete = vi.fn()
    render(<ThreadsPanelView {...baseProps} deleteOpen onConfirmDelete={onConfirmDelete} />)
    expect(screen.getByText('It will be deleted.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirmDelete).toHaveBeenCalledTimes(1)
  })
})
