// Calculation: decide what a single AG-UI event means for the run's Observable — forward it, complete
// the stream, or error it. RUN_FINISHED ends the run; RUN_ERROR fails it (carrying the event's
// message and its typed failure code); every other event is forwarded as-is. Narrowing is by the
// EventType enum and the event's discriminated `type`, never a cast. Kept pure so the Agent's run()
// stays small and this is unit-testable.

import { EventType, type BaseEvent } from '@ag-ui/core'
import {
  toAgentRunFailure,
  type AgentRunFailure
} from '../../../shared/ipc/ipc-event-contract/agent-run-failure'

type RouteOutcome =
  | { readonly kind: 'next'; readonly event: BaseEvent }
  | { readonly kind: 'finish' }
  | { readonly kind: 'error'; readonly message: string; readonly failure: AgentRunFailure }

function errorMessage(event: BaseEvent): string {
  if ('message' in event && typeof event.message === 'string') return event.message
  return 'Agent run failed.'
}

// BaseEvent is a zod passthrough type, so `code` reads as unknown; toAgentRunFailure owns the narrowing
// and collapses an absent or unrecognised value to 'generic'.
const errorFailure = (event: BaseEvent): AgentRunFailure =>
  toAgentRunFailure('code' in event ? event.code : undefined)

export function routeAgentEvent(event: BaseEvent): RouteOutcome {
  if (event.type === EventType.RUN_FINISHED) return { kind: 'finish' }
  if (event.type === EventType.RUN_ERROR) {
    return { kind: 'error', message: errorMessage(event), failure: errorFailure(event) }
  }
  return { kind: 'next', event }
}

export type { RouteOutcome }
