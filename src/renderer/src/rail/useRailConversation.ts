// Derives the rail's conversation view-model from the live agent — the read path. It projects
// agent.messages into rows (the single normalizer for the live-fragmented and reloaded message shapes),
// overlays the current run status (working from agent.isRunning, error from useRunFailed, otherwise
// settled), and exposes the title source (first user message) plus the scroll target (the latest user
// message). No mutation lives here; expand state and submission stay in the controller.

import type { AbstractAgent } from '@ag-ui/client'
import type { AgentRunFailure } from '../../../shared/ipc/ipc-event-contract/agent-run-failure'
import { useScrollSentMessageIntoView } from './useScrollSentMessageIntoView'
import { useRunFailed } from './useRunFailed'
import { createConversationRows, type Row, type StepLabels } from './conversation-rows'
import { applyRunStatus, type RenderRow } from './conversation-render'
import type { RunStatus } from './step'

interface RailConversation {
  readonly rows: readonly RenderRow[]
  readonly firstUserText: string | null
  readonly lastUserId: string | null
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
  // How the current run failed, or null while it has not; the controller turns it into a title + remedy.
  readonly failure: AgentRunFailure | null
}

function runStatus(working: boolean, failed: boolean): RunStatus {
  if (working) return 'working'
  if (failed) return 'error'
  return 'done'
}

const firstUserText = (rows: readonly Row[]): string | null =>
  rows.find((row) => row.kind === 'user')?.text ?? null

const lastUserId = (rows: readonly Row[]): string | null =>
  [...rows].reverse().find((row) => row.kind === 'user')?.id ?? null

function useRailConversation(agent: AbstractAgent, labels: StepLabels): RailConversation {
  const failure = useRunFailed(agent)
  const rows = createConversationRows(labels)(agent.messages)
  const lastId = lastUserId(rows)
  const scrollRef = useScrollSentMessageIntoView(lastId)
  return {
    rows: applyRunStatus(rows, runStatus(agent.isRunning, failure !== null)),
    firstUserText: firstUserText(rows),
    lastUserId: lastId,
    scrollRef,
    failure
  }
}

export { useRailConversation }
export type { RailConversation }
