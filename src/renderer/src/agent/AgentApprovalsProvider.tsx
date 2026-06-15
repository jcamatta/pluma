// Holds the pending gated-tool approvals for the subtree. Pending entries live in state so the rail card
// re-renders as they arrive and clear; the promise resolvers live in a ref keyed by toolCallId (a resolver
// is not render data and must survive re-renders without re-creating). requestApproval parks a call and
// returns the promise the bridge awaits instead of dispatching to a tool handler; resolve settles it with
// the backend's expected shape (it only inspects `.ok`) and removes the entry. Sits above AgentProvider so
// both useToolBridge (inside it) and the rail card can reach the store.

import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { AgentToolResult } from '../../../shared/ipc/ipc-contract/agent'
import type { AgentToolCall } from '../../../shared/ipc/ipc-event-contract/agent'
import {
  AgentApprovalsContext,
  type AgentApprovals,
  type PendingApproval
} from './AgentApprovalsContext'

const approvedResult: AgentToolResult = { ok: true, output: { type: 'text', text: 'approved' } }
const declinedResult: AgentToolResult = { ok: false, error: 'declined' }

export function AgentApprovalsProvider({
  children
}: {
  readonly children: ReactNode
}): React.JSX.Element {
  const [pending, setPending] = useState<readonly PendingApproval[]>([])
  const resolvers = useRef(new Map<string, (result: AgentToolResult) => void>())

  const value = useMemo<AgentApprovals>(
    () => ({
      pending,
      requestApproval: (call: AgentToolCall) =>
        new Promise<AgentToolResult>((resolve) => {
          resolvers.current.set(call.toolCallId, resolve)
          setPending((current) => [...current, call])
        }),
      resolve: (toolCallId, approved) => {
        const settle = resolvers.current.get(toolCallId)
        if (!settle) return
        resolvers.current.delete(toolCallId)
        setPending((current) => current.filter((entry) => entry.toolCallId !== toolCallId))
        settle(approved ? approvedResult : declinedResult)
      }
    }),
    [pending]
  )

  return <AgentApprovalsContext.Provider value={value}>{children}</AgentApprovalsContext.Provider>
}
