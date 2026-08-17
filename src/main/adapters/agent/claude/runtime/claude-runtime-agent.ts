// RuntimeAgent adapter backed by the Claude Agent SDK. The only place that touches `query`. One run is
// active at a time, held in a Ref so the adapter has no global mutable state. `run` mints a runId, starts
// the SDK query in streaming-input mode, records it as the active run, and returns the run's AG-UI events
// as a Stream built straight from the query. `abort` marks the active run aborted and interrupts the
// query; the event stream then closes with an interrupt outcome instead of an error.
//
// Frontend tools suspend through the run's tool bridge: each generated SDK tool handler (see
// build-frontend-tool-server) calls the bridge, which keeps the handler's promise pending until the renderer
// answers and `submitToolResult` resolves it. On abort the bridge rejects any outstanding calls.

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Query } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import type { AgentToolResultMessage } from '../../../../application/agent/data/agent-tool'
import type { RunAgentInput } from '../../../../application/agent/data/run-agent-input'
import type { RunAgentOutput } from '../../../../application/agent/data/run-agent-output'
import { RunAgentFailed } from '../../../../application/agent/error/run-agent-failed'
import {
  RuntimeAgent,
  type SendToolCall
} from '../../../../application/agent/port/runtime-agent.port'
import { buildOptions, DEFAULT_MODEL } from '../logic/build-options'
import { contextWindowForModel } from '../logic/context-window'
import { packagedClaudeExecutable } from './claude-executable'
import { buildFrontendToolServer } from './build-frontend-tool-server'
import { buildBackendToolServer } from './build-backend-tool-server'
import { backendTools } from '../../tools/backend'
import { createToolBridge, type ToolBridge } from '../../tools/tool-bridge'
import { runEventStream } from './run-event-stream'
import { streamInput } from './stream-input'

interface ActiveRun {
  readonly runId: string
  readonly query: Query
  readonly bridge: ToolBridge
  readonly aborted: boolean
}

type ActiveRef = Ref.Ref<ActiveRun | undefined>

// Resolved once: the app's layout cannot change while it runs, and every run would otherwise repeat the
// same directory scan.
const executablePath = packagedClaudeExecutable()

interface RunRequest {
  readonly input: RunAgentInput
  readonly sendToolCall: SendToolCall
}

const startRun = (
  active: ActiveRef,
  request: RunRequest
): Effect.Effect<RunAgentOutput, RunAgentFailed> =>
  Effect.gen(function* () {
    const { input } = request
    const runId = crypto.randomUUID()
    const bridge = createToolBridge(request.sendToolCall)
    const toolServer = buildFrontendToolServer(input.tools, { bridge, runId })
    const backend = backendTools({ cwd: input.cwd, bridge, runId })
    const backendToolServer = buildBackendToolServer(backend)
    const sdkQuery = yield* Effect.try({
      try: () =>
        query({
          prompt: streamInput(input),
          options: buildOptions({
            threadId: input.threadId,
            cwd: input.cwd,
            state: input.state,
            toolServer,
            tools: input.tools,
            backendToolServer,
            backendTools: backend.map((t) => t.spec),
            executablePath
          })
        }),
      catch: () => new RunAgentFailed({ runId })
    })
    yield* Ref.set(active, { runId, query: sdkQuery, bridge, aborted: false })
    const aborted = Ref.get(active).pipe(Effect.map((run) => run?.aborted === true))
    const contextWindow = contextWindowForModel(input.state?.model ?? DEFAULT_MODEL)
    return { runId, events: runEventStream(sdkQuery, { runId, aborted, contextWindow }) }
  })

const resolveToolResult = (
  active: ActiveRef,
  message: AgentToolResultMessage
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const run = yield* Ref.get(active)
    if (run === undefined || run.runId !== message.runId) return
    run.bridge.resolve(message.toolCallId, message.result)
  })

const abortRun = (active: ActiveRef): Effect.Effect<void> =>
  Effect.gen(function* () {
    const run = yield* Ref.get(active)
    if (run === undefined) return
    run.bridge.rejectAll('Run aborted before the tool result arrived.')
    yield* Ref.set(active, { ...run, aborted: true })
    // Best-effort: the SDK's interrupt rejects when the query has no live session yet (aborted before
    // its first turn, or already finished). Abort is a no-op in those cases, so swallow the rejection
    // rather than let it surface as a handler defect.
    yield* Effect.tryPromise(() => run.query.interrupt()).pipe(Effect.ignore)
  })

const make = Ref.make<ActiveRun | undefined>(undefined).pipe(
  Effect.map((active) =>
    RuntimeAgent.of({
      run: (input, sendToolCall) => startRun(active, { input, sendToolCall }),
      submitToolResult: (message) => resolveToolResult(active, message),
      abort: () => abortRun(active)
    })
  )
)

export const ClaudeRuntimeAgentLive = Layer.effect(RuntimeAgent, make)
