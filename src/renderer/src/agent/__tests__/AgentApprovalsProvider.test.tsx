// The approvals store parks a gated call and settles its promise on the user's decision: requestApproval
// adds a pending entry the card renders and returns a promise; resolve(id, approved) removes the entry and
// settles with the backend's expected shape (approved → ok text 'approved', rejected → declined). A resolve
// for an unknown id is a no-op so a double-answer can't throw.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AgentToolCall } from '../../../../shared/ipc/ipc-event-contract/agent'
import { AgentApprovalsProvider } from '../AgentApprovalsProvider'
import { useAgentApprovals } from '../AgentApprovalsContext'

const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
  <AgentApprovalsProvider>{children}</AgentApprovalsProvider>
)

const call: AgentToolCall = {
  runId: 'run-1',
  toolCallId: 'tc-1',
  toolName: 'create_file',
  args: { path: '/a.md' }
}

describe('AgentApprovalsProvider', () => {
  it('parks a call as pending and resolves ok on approve', async () => {
    const { result } = renderHook(() => useAgentApprovals(), { wrapper })

    const answeredHolder: { current: Promise<unknown> | null } = { current: null }
    act(() => {
      answeredHolder.current = result.current.requestApproval(call)
    })

    expect(result.current.pending).toEqual([call])

    act(() => result.current.resolve('tc-1', true))

    expect(result.current.pending).toEqual([])
    await expect(answeredHolder.current).resolves.toEqual({
      ok: true,
      output: { type: 'text', text: 'approved' }
    })
  })

  it('resolves declined on reject', async () => {
    const { result } = renderHook(() => useAgentApprovals(), { wrapper })

    const answeredHolder: { current: Promise<unknown> | null } = { current: null }
    act(() => {
      answeredHolder.current = result.current.requestApproval(call)
    })
    act(() => result.current.resolve('tc-1', false))

    expect(result.current.pending).toEqual([])
    await expect(answeredHolder.current).resolves.toEqual({ ok: false, error: 'declined' })
  })

  it('ignores a resolve for an unknown toolCallId', () => {
    const { result } = renderHook(() => useAgentApprovals(), { wrapper })
    act(() => result.current.resolve('nope', true))
    expect(result.current.pending).toEqual([])
  })
})
