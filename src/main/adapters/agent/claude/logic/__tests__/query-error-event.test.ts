// Tests for queryErrorEvent: the calculation choosing the closing AG-UI event when a query throws.

import { EventType } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import { queryErrorEvent } from '../query-error-event'

describe('queryErrorEvent', () => {
  it('closes an aborted run with RUN_FINISHED carrying an interrupt outcome', () => {
    expect(queryErrorEvent(true, 'run-1')).toStrictEqual({
      type: EventType.RUN_FINISHED,
      runId: 'run-1',
      outcome: { type: 'interrupt', interrupts: [{ id: 'run-1', reason: 'user_abort' }] }
    })
  })

  it('closes a failed run with RUN_ERROR', () => {
    expect(queryErrorEvent(false, 'run-1')).toStrictEqual({
      type: EventType.RUN_ERROR,
      runId: 'run-1',
      message: 'agent run failed'
    })
  })
})
