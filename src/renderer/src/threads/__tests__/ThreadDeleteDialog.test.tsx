// ThreadDeleteDialog is a pure controlled dialog: it renders its content only when open, fires onConfirm
// from the destructive action button, and fires onCancel from the cancel button. No IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThreadDeleteDialog } from '../ThreadDeleteDialog'
import type { ThreadDeleteDialogLabels } from '../ThreadDeleteDialog'

const labels: ThreadDeleteDialogLabels = {
  title: 'Delete chat?',
  message: 'It will be deleted.',
  confirm: 'Delete',
  cancel: 'Cancel'
}

describe('ThreadDeleteDialog', () => {
  it('does not render its content when closed', () => {
    render(
      <ThreadDeleteDialog open={false} labels={labels} onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.queryByText('It will be deleted.')).not.toBeInTheDocument()
  })

  it('fires onConfirm from the destructive button', () => {
    const onConfirm = vi.fn()
    render(<ThreadDeleteDialog open labels={labels} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel from the cancel button', () => {
    const onCancel = vi.fn()
    render(<ThreadDeleteDialog open labels={labels} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
