// routeAgentEvent: RUN_FINISHED completes, RUN_ERROR errors with its message and failure code,
// everything else forwards unchanged.

import { describe, expect, it } from 'vitest'
import { EventType, type BaseEvent } from '@ag-ui/core'
import { routeAgentEvent } from '../route-agent-event'

describe('routeAgentEvent', () => {
  it('forwards a text-message event', () => {
    const event: BaseEvent = { type: EventType.TEXT_MESSAGE_CONTENT }
    expect(routeAgentEvent(event)).toEqual({ kind: 'next', event })
  })

  it('finishes on RUN_FINISHED', () => {
    expect(routeAgentEvent({ type: EventType.RUN_FINISHED })).toEqual({ kind: 'finish' })
  })

  it('errors on RUN_ERROR carrying its message and failure code', () => {
    const event: BaseEvent = { type: EventType.RUN_ERROR, message: 'boom', code: 'authentication' }
    expect(routeAgentEvent(event)).toEqual({
      kind: 'error',
      message: 'boom',
      failure: 'authentication'
    })
  })

  it('errors with a fallback message when RUN_ERROR has none', () => {
    const outcome = routeAgentEvent({ type: EventType.RUN_ERROR })
    expect(outcome).toEqual({ kind: 'error', message: 'Agent run failed.', failure: 'generic' })
  })

  it('reads a RUN_ERROR without a code as a generic failure', () => {
    const outcome = routeAgentEvent({ type: EventType.RUN_ERROR, message: 'boom' })
    expect(outcome).toEqual({ kind: 'error', message: 'boom', failure: 'generic' })
  })

  it('collapses an unrecognised code to a generic failure', () => {
    const event: BaseEvent = { type: EventType.RUN_ERROR, message: 'boom', code: 'meteor' }
    expect(routeAgentEvent(event)).toEqual({ kind: 'error', message: 'boom', failure: 'generic' })
  })
})
