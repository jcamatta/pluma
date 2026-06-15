// ApprovalCardList lays out the cards it is given and wires each card's Approve / Reject to the callbacks
// in its props. Pure render assertions only — no store, no i18n — so the layout/animation boundary is
// covered independently of how the controller derives the props.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ApprovalCardProps } from '../ApprovalCard.view'
import { ApprovalCardList } from '../ApprovalCardList.view'

function createCard(overrides: Partial<ApprovalCardProps> = {}): ApprovalCardProps {
  return {
    toolCallId: 'tc-1',
    paths: { kind: 'create', path: '/notes/new.md' },
    labels: { action: 'Create file', approve: 'Approve', reject: 'Reject' },
    onApprove: vi.fn(),
    onReject: vi.fn(),
    ...overrides
  }
}

describe('ApprovalCardList', () => {
  it('renders nothing when there are no cards', () => {
    render(<ApprovalCardList cards={[]} />)
    expect(screen.queryByTestId('approval-cards')).toBeNull()
  })

  it('renders a card per item with its path and action label', () => {
    render(<ApprovalCardList cards={[createCard()]} />)
    expect(screen.getByTestId('approval-cards')).toBeInTheDocument()
    expect(screen.getByText('/notes/new.md')).toBeInTheDocument()
    expect(screen.getByText('Create file')).toBeInTheDocument()
  })

  it('invokes the card callbacks on Approve and Reject', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(<ApprovalCardList cards={[createCard({ onApprove, onReject })]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })
})
