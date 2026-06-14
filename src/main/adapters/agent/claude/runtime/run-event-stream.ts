// Action: turn one live Claude SDK Query into a Stream of AG-UI events (@ag-ui/core). Each SDK message is
// folded into events by stepRunEvent; if the query throws, the closing event is decided by reading the
// run's aborted flag (an effect) and mapping it through queryErrorEvent. The pure mapping lives in logic;
// this file only wires the live query and the Ref read into the stream.

import { type BaseEvent } from '@ag-ui/core'
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

const onQueryError = (deps: RunDeps): Stream.Stream<BaseEvent> =>
  Stream.unwrap(
    deps.aborted.pipe(
      Effect.map((wasAborted) => Stream.make(queryErrorEvent(wasAborted, deps.runId)))
    )
  )

export const runEventStream = (query: Query, deps: RunDeps): Stream.Stream<BaseEvent> =>
  Stream.fromAsyncIterable(query, (error) => error).pipe(
    Stream.mapAccum(
      newRunAccumulator(),
      stepRunEvent({ runId: deps.runId, contextWindow: deps.contextWindow })
    ),
    Stream.flattenIterables,
    Stream.catchAll(() => onQueryError(deps))
  )
