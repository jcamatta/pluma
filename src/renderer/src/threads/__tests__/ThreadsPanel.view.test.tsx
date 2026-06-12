// ThreadsPanelView is pure: it renders the thread rows from props, shows an empty state when there are
// none, highlights the active row, and fires onSelect / onNewThread / onBack on interaction. No IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThreadsPanelView } from '../ThreadsPanel.view'
import type { ThreadRow, ThreadsPanelLabels } from '../ThreadsPanel.view'

const labels: ThreadsPanelLabels = {
  title: 'Chats',
  newThread: 'New chat',
  back: 'Back',
  empty: 'No chats yet.'
}

const noop = (): void => undefined

const emptyRows: readonly ThreadRow[] = []

const baseProps = {
  labels,
  rows: emptyRows,
  onSelect: noop,
  onNewThread: noop,
  onBack: noop
}

describe('ThreadsPanelView', () => {
  it('shows the empty message when there are no threads', () => {
    render(<ThreadsPanelView {...baseProps} />)
    expect(screen.getByText('No chats yet.')).toBeInTheDocument()
  })

  it('renders a row per thread with its title and subtitle', () => {
    const rows: readonly ThreadRow[] = [
      { id: 's1', title: 'Draft review', subtitle: '2 hours ago', active: false },
      { id: 's2', title: 'Outline', subtitle: 'yesterday', active: true }
    ]
    render(<ThreadsPanelView {...baseProps} rows={rows} />)
    expect(screen.getByText('Draft review')).toBeInTheDocument()
    expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    expect(screen.getByText('Outline')).toBeInTheDocument()
  })

  it('fires onSelect with the row id when a row is clicked', () => {
    const onSelect = vi.fn()
    const rows: readonly ThreadRow[] = [
      { id: 's1', title: 'Draft review', subtitle: '2 hours ago', active: false }
    ]
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
})
