// Tests for the abortAgent use case against an in-memory RuntimeAgent fake. Verifies the call is
// delegated to the port with the given runId and that the use case succeeds.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import { describe, expect, it } from 'vitest'
import { RuntimeAgent } from '../../port/runtime-agent.port'
import type { RuntimeAgentPort } from '../../port/runtime-agent.port'
import { abortAgent } from '../abort-agent'

const agentRecording = (aborted: string[]): Layer.Layer<RuntimeAgentPort> =>
  Layer.succeed(
    RuntimeAgent,
    RuntimeAgent.of({
      run: () => Effect.succeed({ runId: 'run-1', events: Stream.empty }),
      submitToolResult: () => Effect.void,
      abort: (runId) =>
        Effect.sync(() => {
          aborted.push(runId)
        })
    })
  )

describe('abortAgent', () => {
  it('delegates the abort to the agent with the given runId', () => {
    const aborted: string[] = []
    const exit = Effect.runSyncExit(Effect.provide(abortAgent('run-1'), agentRecording(aborted)))

    expect(exit).toStrictEqual(Exit.succeed(undefined))
    expect(aborted).toStrictEqual(['run-1'])
  })
})
