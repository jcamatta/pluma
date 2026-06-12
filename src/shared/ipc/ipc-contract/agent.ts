// Wire contracts for the agent channels. The agent input is built purely from @ag-ui/core types (a
// package both processes depend on), so the wire shape is declared here independently of the
// application layer's own RunAgentInput. The two are structurally identical, so the ipc handler hands
// the received input straight to the use case. agent:run returns only an ack carrying the minted runId:
// the BaseEvent stream cannot cross IPC, so events arrive on the separate agent:event event channel.

import type { Message, Tool } from '@ag-ui/core'
import type { IpcContractDefinition } from './types'

type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type Model = 'claude-opus-4-8'

interface RunAgentState {
  readonly effort?: EffortLevel
  readonly model?: Model
}

interface AgentContextEntry {
  readonly description: string
  readonly value: string
}

interface RunAgentInput {
  readonly messages: readonly Message[]
  readonly threadId?: string
  readonly cwd?: string
  readonly tools: readonly Tool[]
  readonly state?: RunAgentState
  readonly context?: readonly AgentContextEntry[]
}

const AGENT_RUN_CHANNEL = 'agent:run'
const AGENT_ABORT_CHANNEL = 'agent:abort'
const AGENT_TOOL_RESULT_CHANNEL = 'agent:tool-result'
const AGENT_LIST_THREADS_CHANNEL = 'agent:list-threads'
const AGENT_THREAD_HISTORY_CHANNEL = 'agent:thread-history'
const AGENT_RENAME_THREAD_CHANNEL = 'agent:rename-thread'
const AGENT_DELETE_THREAD_CHANNEL = 'agent:delete-thread'

interface RunAgentError {
  readonly _tag: 'RunAgentFailed'
}

// The wire shape of one past thread in the list: the SDK session id, its (stored or derived) title, and
// its last-modified time in epoch milliseconds. Declared here so the renderer reads it without importing
// the application layer's own ThreadSummary.
interface ThreadSummary {
  readonly id: string
  readonly title: string
  readonly updatedAt: number
}

// Both thread reads fail the same way: the session is missing or unreadable. The renderer maps the tag
// to a translated message.
interface ThreadReadError {
  readonly _tag: 'ThreadReadFailed'
}

interface ListThreadsInput {
  readonly cwd: string
}

interface ThreadHistoryInput {
  readonly cwd: string
  readonly threadId: string
}

// Both thread writes fail the same way: the session is missing or could not be written. The renderer
// maps the tag to a translated message.
interface ThreadWriteError {
  readonly _tag: 'ThreadWriteFailed'
}

interface RenameThreadRequest {
  readonly cwd: string
  readonly threadId: string
  readonly title: string
}

interface DeleteThreadRequest {
  readonly cwd: string
  readonly threadId: string
}

// The renderer → main half of the frontend-tool round-trip: the output a tool handler produced for an
// AgentToolCall. These are the single source on the wire — the renderer's agent/tools/types.ts aligns
// with them. `AgentToolOutput` is what the model ultimately sees; `AgentToolResult` lets a handler
// report a recoverable failure (range drifted, not found, ambiguous) without throwing.
type AgentToolOutput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'json'; readonly value: unknown }

type AgentToolResult =
  | { readonly ok: true; readonly output: AgentToolOutput }
  | { readonly ok: false; readonly error: string }

// The envelope sent back to resolve a suspended AgentToolCall, keyed by the same toolCallId.
interface AgentToolResultMessage {
  readonly runId: string
  readonly toolCallId: string
  readonly result: AgentToolResult
}

type AgentRunContract = IpcContractDefinition<
  typeof AGENT_RUN_CHANNEL,
  RunAgentInput,
  { readonly runId: string },
  RunAgentError
>

type AgentAbortContract = IpcContractDefinition<typeof AGENT_ABORT_CHANNEL, string, null, never>

type AgentListThreadsContract = IpcContractDefinition<
  typeof AGENT_LIST_THREADS_CHANNEL,
  ListThreadsInput,
  readonly ThreadSummary[],
  ThreadReadError
>

type AgentThreadHistoryContract = IpcContractDefinition<
  typeof AGENT_THREAD_HISTORY_CHANNEL,
  ThreadHistoryInput,
  readonly Message[],
  ThreadReadError
>

type AgentRenameThreadContract = IpcContractDefinition<
  typeof AGENT_RENAME_THREAD_CHANNEL,
  RenameThreadRequest,
  null,
  ThreadWriteError
>

type AgentDeleteThreadContract = IpcContractDefinition<
  typeof AGENT_DELETE_THREAD_CHANNEL,
  DeleteThreadRequest,
  null,
  ThreadWriteError
>

type AgentToolResultContract = IpcContractDefinition<
  typeof AGENT_TOOL_RESULT_CHANNEL,
  AgentToolResultMessage,
  null,
  never
>

export {
  AGENT_RUN_CHANNEL,
  AGENT_ABORT_CHANNEL,
  AGENT_TOOL_RESULT_CHANNEL,
  AGENT_LIST_THREADS_CHANNEL,
  AGENT_THREAD_HISTORY_CHANNEL,
  AGENT_RENAME_THREAD_CHANNEL,
  AGENT_DELETE_THREAD_CHANNEL,
  type RunAgentState,
  type AgentContextEntry,
  type RunAgentInput,
  type RunAgentError,
  type ThreadSummary,
  type ThreadReadError,
  type ThreadWriteError,
  type ListThreadsInput,
  type ThreadHistoryInput,
  type RenameThreadRequest,
  type DeleteThreadRequest,
  type AgentToolOutput,
  type AgentToolResult,
  type AgentToolResultMessage,
  type AgentRunContract,
  type AgentAbortContract,
  type AgentToolResultContract,
  type AgentListThreadsContract,
  type AgentThreadHistoryContract,
  type AgentRenameThreadContract,
  type AgentDeleteThreadContract
}
