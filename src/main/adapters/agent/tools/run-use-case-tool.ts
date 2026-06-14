import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import type { AgentToolOutput, AgentToolResult } from '../../../application/agent/data/agent-tool'

interface RunUseCaseToolOptions<A, E extends { _tag: string }> {
  readonly effect: Effect.Effect<A, E>
  readonly toOutput: (value: A) => AgentToolOutput
  readonly fallback: string
}

const runUseCaseTool = <A, E extends { _tag: string }>(
  options: RunUseCaseToolOptions<A, E>
): Effect.Effect<AgentToolResult> =>
  Effect.matchCause(options.effect, {
    onSuccess: (value): AgentToolResult => ({ ok: true, output: options.toOutput(value) }),
    onFailure: (cause): AgentToolResult => ({
      ok: false,
      error: Option.match(Cause.failureOption(cause), {
        // A typed failure carries the use case's tag; a defect has none, so fall back to a stable label.
        onNone: () => options.fallback,
        onSome: (error) => error._tag
      })
    })
  })

export { runUseCaseTool }
export type { RunUseCaseToolOptions }
