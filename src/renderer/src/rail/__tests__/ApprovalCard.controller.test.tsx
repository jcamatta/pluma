// ApprovalCardController renders the live pending approvals from the store, resolving each card's action
// label and path(s) from the call's args. Approving resolves the parked promise as ok and removes the card;
// rejecting resolves it as declined. Nothing renders when there is nothing to approve. Driven through the
// real AgentApprovalsProvider so the card and its decision share one store, with i18n for the labels.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { invariant } from '../../../../shared/invariant'
import type { AgentToolCall } from '../../../../shared/ipc/ipc-event-contract/agent'
import { AgentApprovalsProvider } from '../../agent/AgentApprovalsProvider'
import { useAgentApprovals } from '../../agent/AgentApprovalsContext'
import { ApprovalCardController } from '../ApprovalCard.controller'

// Render the controller and the store together so a request from the store surfaces a card and the card's
// click resolves the very promise that request returned. Returns the store handle for driving requests.
function mount(): { readonly store: ReturnType<typeof useAgentApprovals> } {
  const ref: { current: ReturnType<typeof useAgentApprovals> | null } = { current: null }
  function Capture(): null {
    ref.current = useAgentApprovals()
    return null
  }
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <I18nextProvider i18n={i18n}>
      <AgentApprovalsProvider>
        <Capture />
        {children}
      </AgentApprovalsProvider>
    </I18nextProvider>
  )
  render(<ApprovalCardController />, { wrapper })
  invariant(ref.current, 'store not captured')
  return { store: ref.current }
}

const createCall: AgentToolCall = {
  runId: 'run-1',
  toolCallId: 'tc-1',
  toolName: 'create_file',
  args: { path: '/notes/new.md' }
}

describe('ApprovalCardController', () => {
  it('renders nothing when there are no pending approvals', () => {
    mount()
    expect(screen.queryByTestId('approval-cards')).toBeNull()
  })

  it('shows the path and resolves ok on Approve, then removes the card', async () => {
    const { store } = mount()

    const answeredHolder: { current: Promise<unknown> | null } = { current: null }
    act(() => {
      answeredHolder.current = store.requestApproval(createCall)
    })

    expect(screen.getByText('/notes/new.md')).toBeInTheDocument()
    expect(screen.getByText('Create file')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await expect(answeredHolder.current).resolves.toEqual({
      ok: true,
      output: { type: 'text', text: 'approved' }
    })
    expect(screen.queryByText('/notes/new.md')).toBeNull()
  })

  it('resolves declined on Reject', async () => {
    const { store } = mount()

    const answeredHolder: { current: Promise<unknown> | null } = { current: null }
    act(() => {
      answeredHolder.current = store.requestApproval({
        ...createCall,
        toolName: 'delete_file',
        args: { path: '/notes/old.md' }
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await expect(answeredHolder.current).resolves.toEqual({ ok: false, error: 'declined' })
  })
})
