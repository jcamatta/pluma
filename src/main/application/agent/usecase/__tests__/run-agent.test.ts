// Tests for the runAgent use case against an in-memory RuntimeAgent fake. Covers the success path (the
// minted runId and the AG-UI event stream are returned) and the typed RunAgentFailed failure.

import { EventType, type BaseEvent } from '@ag-ui/core'
import * as Chunk from 'effect/Chunk'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import { describe, expect, it } from 'vitest'
import { RunAgentFailed } from '../../error/run-agent-failed'
import { RuntimeAgent } from '../../port/runtime-agent.port'
import type { RuntimeAgentPort } from '../../port/runtime-agent.port'
import { runAgent } from '../run-agent'

const events: readonly BaseEvent[] = [
  { type: EventType.RUN_STARTED },
  { type: EventType.RUN_FINISHED }
]

// The frontend-tool-call sender; runAgent forwards it to the port. These tests don't drive tool calls.
const noopSendToolCall = (): void => {}

const agentThatSucceeds = (runId: string): Layer.Layer<RuntimeAgentPort> =>
  Layer.succeed(
    RuntimeAgent,
    RuntimeAgent.of({
      run: () => Effect.succeed({ runId, events: Stream.fromIterable(events) }),
      submitToolResult: () => Effect.void,
      abort: () => Effect.void
    })
  )

const agentThatFails = (error: RunAgentFailed): Layer.Layer<RuntimeAgentPort> =>
  Layer.succeed(
    RuntimeAgent,
    RuntimeAgent.of({
      run: () => Effect.fail(error),
      submitToolResult: () => Effect.void,
      abort: () => Effect.void
    })
  )

describe('runAgent', () => {
  it('returns the runId and streams the AG-UI events on success', async () => {
    const program = Effect.gen(function* () {
      const run = yield* runAgent({ messages: [], tools: [] }, noopSendToolCall)
      const collected = yield* Stream.runCollect(run.events)
      return { runId: run.runId, events: Chunk.toReadonlyArray(collected) }
    })

    const result = await Effect.runPromise(Effect.provide(program, agentThatSucceeds('run-1')))

    expect(result.runId).toBe('run-1')
    expect(result.events).toStrictEqual(events)
  })

  it('propagates RunAgentFailed from the agent', async () => {
    const error = new RunAgentFailed({ runId: 'run-1' })
    const exit = await Effect.runPromiseExit(
      Effect.provide(runAgent({ messages: [], tools: [] }, noopSendToolCall), agentThatFails(error))
    )

    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
