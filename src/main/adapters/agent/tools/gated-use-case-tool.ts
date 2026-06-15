// Gates a use-case Effect behind a human approval round-trip on the existing tool bridge, then reuses
// runUseCaseTool to fold the use case into an AgentToolResult. The bridge.callTool suspends until the
// renderer answers: ok=true approves and the use case runs; ok=false declines and the use case never
// runs (Effect laziness — only runUseCaseTool ever evaluates the effect). The args are forwarded to the
// renderer untouched so the approval card can render the action and path; this helper builds no summary,
// the renderer owns the i18n label.

import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import type { AgentToolOutput, AgentToolResult } from '../../../application/agent/data/agent-tool'
import { runUseCaseTool } from './run-use-case-tool'
import type { ToolBridge } from './tool-bridge'

interface GatedDeps {
  readonly bridge: ToolBridge
  readonly runId: string
}

interface GatedUseCaseToolOptions<A, E extends { _tag: string }> {
  readonly bridge: ToolBridge
  readonly runId: string
  readonly toolName: string
  readonly args: unknown
  readonly effect: Effect.Effect<A, E>
  readonly toOutput: (value: A) => AgentToolOutput
  readonly fallback: string
}

const gatedUseCaseTool = <A, E extends { _tag: string }>(
  options: GatedUseCaseToolOptions<A, E>
): Effect.Effect<AgentToolResult> =>
  Effect.promise(() =>
    options.bridge.callTool({
      runId: options.runId,
      toolCallId: randomUUID(),
      toolName: options.toolName,
      args: options.args
    })
  ).pipe(
    Effect.flatMap((approval): Effect.Effect<AgentToolResult> => {
      if (!approval.ok) {
        return Effect.succeed({ ok: false, error: 'declined' })
      }
      return runUseCaseTool({
        effect: options.effect,
        toOutput: options.toOutput,
        fallback: options.fallback
      })
    })
  )

export { gatedUseCaseTool }
export type { GatedDeps, GatedUseCaseToolOptions }
