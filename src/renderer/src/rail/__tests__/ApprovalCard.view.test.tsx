// ApprovalCard shows the action label and the path(s) for each gated kind, and routes Approve / Reject to
// its callbacks. A create/delete shows one path; a rename shows old and new; an unknown shape still renders
// the action label with no path block (never crashes).

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ApprovalCard } from '../ApprovalCard.view'

const labels = { action: 'Create file', approve: 'Approve', reject: 'Reject' }

describe('ApprovalCard', () => {
  it('renders the action label and path with both actions', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <ApprovalCard
        toolCallId="tc-1"
        paths={{ kind: 'create', path: '/notes/new.md' }}
        labels={labels}
        onApprove={onApprove}
        onReject={onReject}
      />
    )

    expect(screen.getByText('Create file')).toBeInTheDocument()
    expect(screen.getByText('/notes/new.md')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('shows both paths for a rename', () => {
    render(
      <ApprovalCard
        toolCallId="tc-1"
        paths={{ kind: 'rename', oldPath: '/a.md', newPath: '/b.md' }}
        labels={{ ...labels, action: 'Rename file' }}
        onApprove={() => undefined}
        onReject={() => undefined}
      />
    )

    expect(screen.getByText('/a.md')).toBeInTheDocument()
    expect(screen.getByText('/b.md')).toBeInTheDocument()
  })

  it('renders the action label without a path for an unknown shape', () => {
    render(
      <ApprovalCard
        toolCallId="tc-1"
        paths={{ kind: 'unknown' }}
        labels={{ ...labels, action: 'Approve action' }}
        onApprove={() => undefined}
        onReject={() => undefined}
      />
    )

    expect(screen.getByText('Approve action')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })
})
