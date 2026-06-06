// The single RuntimeAgent instance shared by the agent IPC handlers. agent:run and agent:abort must
// reach the same in-flight run, so the Claude adapter (which holds the active-run Ref) is built once here
// and reused. Built synchronously at module load from the live Layer.

import * as Effect from 'effect/Effect'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import type { RuntimeAgentPort } from '../../application/agent/port/runtime-agent.port'
import { ClaudeRuntimeAgentLive } from '../../adapters/agent/claude/runtime/claude-runtime-agent'

export const runtimeAgent: RuntimeAgentPort = Effect.runSync(
  RuntimeAgent.pipe(Effect.provide(ClaudeRuntimeAgentLive))
)
