// Calculation: decide what a single AG-UI event means for the run's Observable — forward it, complete
// the stream, or error it. RUN_FINISHED ends the run; RUN_ERROR fails it (carrying the event's
// message); every other event is forwarded as-is. Narrowing is by the EventType enum and the event's
// discriminated `type`, never a cast. Kept pure so the Agent's run() stays small and this is unit-testable.

import { EventType, type BaseEvent } from '@ag-ui/core'

type RouteOutcome =
  | { readonly kind: 'next'; readonly event: BaseEvent }
  | { readonly kind: 'finish' }
  | { readonly kind: 'error'; readonly message: string }

function errorMessage(event: BaseEvent): string {
  if ('message' in event && typeof event.message === 'string') return event.message
  return 'Agent run failed.'
}

export function routeAgentEvent(event: BaseEvent): RouteOutcome {
  if (event.type === EventType.RUN_FINISHED) return { kind: 'finish' }
  if (event.type === EventType.RUN_ERROR) return { kind: 'error', message: errorMessage(event) }
  return { kind: 'next', event }
}

export type { RouteOutcome }
