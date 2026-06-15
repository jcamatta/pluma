// The agent provider stack the app shell wraps its workspace in, composed once so the order stays
// correct: the tool registry, then the gated-tool approvals store (must sit above AgentProvider so both
// the tool bridge inside it and the rail approval card can reach the store), then the live Agent bound
// to the picked folder.

import type { ReactNode } from 'react'
import { AgentProvider } from './AgentProvider'
import { AgentApprovalsProvider } from './AgentApprovalsProvider'
import { AgentToolsProvider } from './AgentToolsProvider'

export function AgentProviders({
  cwd,
  children
}: {
  readonly cwd: string
  readonly children: ReactNode
}): React.JSX.Element {
  return (
    <AgentToolsProvider>
      <AgentApprovalsProvider>
        <AgentProvider cwd={cwd}>{children}</AgentProvider>
      </AgentApprovalsProvider>
    </AgentToolsProvider>
  )
}
