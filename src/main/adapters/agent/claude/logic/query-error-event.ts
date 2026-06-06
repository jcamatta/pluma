// Calculation: decide the AG-UI event (@ag-ui/core) that closes a run whose underlying query threw. When
// the run was aborted by the user, it ends with RUN_FINISHED carrying an interrupt outcome; otherwise it
// ends with RUN_ERROR.

import { EventType, type BaseEvent } from '@ag-ui/core'

export const queryErrorEvent = (wasAborted: boolean, runId: string): BaseEvent =>
  wasAborted
    ? {
        type: EventType.RUN_FINISHED,
        runId,
        outcome: { type: 'interrupt', interrupts: [{ id: runId, reason: 'user_abort' }] }
      }
    : { type: EventType.RUN_ERROR, runId, message: 'agent run failed' }
