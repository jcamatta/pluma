// Pure overlay of the live run status onto the projected rows. The projection (conversation-rows) turns
// agent.messages into settled user/assistant rows; this decides which row reflects the *current* run.
// Only the in-flight (last) assistant row carries the run's working/error status — every prior assistant
// row is settled ('done'). While a run is live but has not yet produced an assistant message for the
// current turn (the gap between the run starting and its first text/tool block), a synthetic empty
// assistant row is appended so the "thinking" affordance shows. Same rows + status in, same render rows
// out; no React, no IO.

import type { Row } from './conversation-rows'
import type { RunStatus } from './step'

interface RenderRow {
  readonly row: Row
  readonly status: RunStatus
}

const DONE: RunStatus = 'done'
const PENDING_ROW: Row = { kind: 'assistant', id: 'pending', text: '', steps: [] }

const isLive = (status: RunStatus): boolean => status === 'working' || status === 'error'

// Settled rows start collapsed; the live (working/errored) row starts expanded so its steps are visible.
const defaultExpanded = (status: RunStatus): boolean => isLive(status)

function applyRunStatus(rows: readonly Row[], status: RunStatus): readonly RenderRow[] {
  const last = rows.at(-1)
  if (isLive(status) && (last === undefined || last.kind === 'user')) {
    return [...rows.map((row) => ({ row, status: DONE })), { row: PENDING_ROW, status }]
  }
  return rows.map((row, index) => ({
    row,
    status: index === rows.length - 1 && row.kind === 'assistant' ? status : DONE
  }))
}

export { applyRunStatus, defaultExpanded }
export type { RenderRow }
