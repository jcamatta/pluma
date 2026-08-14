// Action: turn one live Claude SDK Query into a Stream of AG-UI events (@ag-ui/core). Each SDK message is
// folded into events by stepRunEvent; if the query throws, the closing event is decided by reading the
// run's aborted flag (an effect) and mapping it through queryErrorEvent. The pure mapping lives in logic;
// this file only wires the live query and the Ref read into the stream.

import { EventType, type BaseEvent } from '@ag-ui/core'
import type { Query } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'
import { queryErrorEvent } from '../logic/query-error-event'
import { newRunAccumulator, stepRunEvent } from '../logic/step-run-event'

interface RunDeps {
  readonly runId: string
  readonly aborted: Effect.Effect<boolean>
  // The context window of the model this run uses — the meter's denominator, folded into each assistant
  // message's usage snapshot.
  readonly contextWindow: number
}

// An Error's message and stack are non-enumerable, so logging the object itself renders `{}` — the
// reason has to be pulled out by hand to survive the log.
const describe = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)

// The thrown error decides no part of the emitted event — an abort still closes as an interrupt and
// anything else as a failure — but it is the only description of what went wrong, so it is logged
// rather than dropped.
const onQueryError = (input: {
  readonly deps: RunDeps
  readonly error: unknown
}): Stream.Stream<BaseEvent> =>
  Stream.unwrap(
    Effect.logError('agent query failed', describe(input.error)).pipe(
      Effect.zipRight(input.deps.aborted),
      Effect.map((wasAborted) => Stream.make(queryErrorEvent(wasAborted, input.deps.runId)))
    )
  )

// A run is over once it has emitted a closing event, and the stream must end with it. The SDK query
// keeps producing past that point — after a failed result it throws — and anything emitted then would be
// a second terminal event for a run the renderer has already closed, landing on whichever run is live by
// the time it arrives.
const isTerminal = (event: BaseEvent): boolean =>
  event.type === EventType.RUN_ERROR || event.type === EventType.RUN_FINISHED

export const runEventStream = (query: Query, deps: RunDeps): Stream.Stream<BaseEvent> =>
  Stream.fromAsyncIterable(query, (error) => error).pipe(
    Stream.mapAccum(
      newRunAccumulator(),
      stepRunEvent({ runId: deps.runId, contextWindow: deps.contextWindow })
    ),
    Stream.flattenIterables,
    Stream.takeUntil(isTerminal),
    Stream.catchAll((error) => onQueryError({ deps, error }))
  )
