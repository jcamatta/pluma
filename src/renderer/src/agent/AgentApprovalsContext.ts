// The approvals store context and its consumer hook. A gated tool call (create/rename/delete file) is
// suspended on the backend until the user answers, so the renderer parks it as a pending approval and
// the rail card resolves it. `requestApproval` is the bridge side: it registers a pending entry and
// returns a promise settled by `resolve`. `pending` is the read side the card renders. `useAgentApprovals`
// is the consumer hook, guarded the same way as useToolRegistry.

import { createContext, useContext } from 'react'
import { invariant } from '../../../shared/invariant'
import type { AgentToolResult } from '../../../shared/ipc/ipc-contract/agent'
import type { AgentToolCall } from '../../../shared/ipc/ipc-event-contract/agent'

// A parked gated tool call awaiting the user's Approve/Reject decision. Mirrors the wire AgentToolCall —
// the card reads toolName + args to summarize the action and keys its decision by toolCallId.
interface PendingApproval {
  readonly runId: string
  readonly toolCallId: string
  readonly toolName: string
  readonly args: unknown
}

interface AgentApprovals {
  // Park a gated call and resolve once the user answers (approved → ok, rejected → declined).
  readonly requestApproval: (call: AgentToolCall) => Promise<AgentToolResult>
  readonly pending: readonly PendingApproval[]
  readonly resolve: (toolCallId: string, approved: boolean) => void
}

const AgentApprovalsContext = createContext<AgentApprovals | undefined>(undefined)

function useAgentApprovals(): AgentApprovals {
  const approvals = useContext(AgentApprovalsContext)
  invariant(approvals, 'useAgentApprovals must be used within an AgentApprovalsProvider')
  return approvals
}

export { AgentApprovalsContext, useAgentApprovals }
export type { AgentApprovals, PendingApproval }
