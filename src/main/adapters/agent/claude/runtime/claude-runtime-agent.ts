// RuntimeAgent adapter backed by the Claude Agent SDK. The only place that touches `query`. One run is
// active at a time, held in a Ref so the adapter has no global mutable state. `run` mints a runId, starts
// the SDK query in streaming-input mode, records it as the active run, and returns the run's AG-UI events
// as a Stream built straight from the query. `abort` marks the active run aborted and interrupts the
// query; the event stream then closes with an interrupt outcome instead of an error.

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Query } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import type { RunAgentInput } from '../../../../application/agent/data/run-agent-input'
import type { RunAgentOutput } from '../../../../application/agent/data/run-agent-output'
import { RunAgentFailed } from '../../../../application/agent/error/run-agent-failed'
import { RuntimeAgent } from '../../../../application/agent/port/runtime-agent.port'
import { buildOptions } from '../logic/build-options'
import { runEventStream } from './run-event-stream'
import { streamInput } from './stream-input'

interface ActiveRun {
  readonly query: Query
  readonly aborted: boolean
}

type ActiveRef = Ref.Ref<ActiveRun | undefined>

const startRun = (
  active: ActiveRef,
  input: RunAgentInput
): Effect.Effect<RunAgentOutput, RunAgentFailed> =>
  Effect.gen(function* () {
    const runId = crypto.randomUUID()
    const sdkQuery = yield* Effect.try({
      try: () =>
        query({
          prompt: streamInput(input.messages),
          options: buildOptions(input.threadId, input.state)
        }),
      catch: () => new RunAgentFailed({ runId })
    })
    yield* Ref.set(active, { query: sdkQuery, aborted: false })
    const aborted = Ref.get(active).pipe(Effect.map((run) => run?.aborted === true))
    return { runId, events: runEventStream(sdkQuery, { runId, aborted }) }
  })

const abortRun = (active: ActiveRef): Effect.Effect<void> =>
  Effect.gen(function* () {
    const run = yield* Ref.get(active)
    if (run === undefined) return
    yield* Ref.set(active, { query: run.query, aborted: true })
    yield* Effect.promise(() => run.query.interrupt())
  })

const make = Ref.make<ActiveRun | undefined>(undefined).pipe(
  Effect.map((active) =>
    RuntimeAgent.of({
      run: (input) => startRun(active, input),
      abort: () => abortRun(active)
    })
  )
)

export const ClaudeRuntimeAgentLive = Layer.effect(RuntimeAgent, make)
