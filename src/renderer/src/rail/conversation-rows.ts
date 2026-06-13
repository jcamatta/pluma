// Pure projection: turn the agent's flat Message[] into the rows the rail renders — one user bubble and
// one grouped assistant bubble per turn, each assistant row carrying its concatenated reply text and a
// derived step timeline. It is the single normalizer for the two Message shapes that mean the same turn:
// the live stream fragments a turn into several messages (a per-text-block assistant message, a separate
// assistant message per tool call, then the tool result), while a reloaded turn is more consolidated.
// Grouping by user-message boundaries and matching tool results to calls by id collapses both to the same
// rows. A step is `calling` until its tool result lands, then `success`; failure styling is intentionally
// not derived (AG-UI's apply() drops the tool error, so it cannot be shown live — see the plan). Labels
// are injected so no copy lives here; same input → same output, no React, no IO.

import type { Message, ToolCall, ToolMessage } from '@ag-ui/core'
import type { LogEntry } from './step'

interface StepLabels {
  readonly calling: (toolName: string) => string
  readonly done: (toolName: string) => string
}

interface UserRow {
  readonly kind: 'user'
  readonly id: string
  readonly text: string
}

interface AssistantRow {
  readonly kind: 'assistant'
  readonly id: string
  readonly text: string
  readonly steps: readonly LogEntry[]
}

type Row = UserRow | AssistantRow

interface RawStep {
  readonly id: string
  readonly toolName: string
  readonly settled: boolean
  readonly meta?: string
}

interface FoldedTurn {
  readonly text: string
  readonly steps: readonly RawStep[]
}

const stepsFromCalls = (calls: readonly ToolCall[]): readonly RawStep[] =>
  calls.map((call) => ({ id: call.id, toolName: call.function.name, settled: false }))

const settleStep = (steps: readonly RawStep[], result: ToolMessage): readonly RawStep[] =>
  steps.map((step) =>
    step.id === result.toolCallId
      ? { ...step, settled: true, meta: result.content || undefined }
      : step
  )

const foldTurn = (messages: readonly Message[]): FoldedTurn =>
  messages.reduce<FoldedTurn>(
    (turn, message) => {
      if (message.role === 'assistant') {
        return {
          text: turn.text + (message.content ?? ''),
          steps: [...turn.steps, ...stepsFromCalls(message.toolCalls ?? [])]
        }
      }
      if (message.role === 'tool')
        return { text: turn.text, steps: settleStep(turn.steps, message) }
      return turn
    },
    { text: '', steps: [] }
  )

// Split the flat array into turns: a user message (or the very first message) opens a turn; every
// following assistant/tool message belongs to it until the next user message.
const groupTurns = (messages: readonly Message[]): readonly (readonly Message[])[] =>
  messages.reduce<readonly (readonly Message[])[]>((turns, message) => {
    if (message.role === 'user' || turns.length === 0) return [...turns, [message]]
    return [...turns.slice(0, -1), [...turns[turns.length - 1], message]]
  }, [])

const userRow = (turn: readonly Message[]): readonly Row[] => {
  const user = turn.find((message) => message.role === 'user')
  if (user === undefined || typeof user.content !== 'string') return []
  const text = user.content.trim()
  return text.length === 0 ? [] : [{ kind: 'user', id: user.id, text }]
}

const assistantRow = (
  turn: readonly Message[],
  toEntry: (step: RawStep) => LogEntry
): readonly Row[] => {
  const first = turn.find((message) => message.role === 'assistant')
  if (first === undefined) return []
  const folded = foldTurn(turn)
  const steps = folded.steps.map(toEntry)
  if (folded.text.trim().length === 0 && steps.length === 0) return []
  return [{ kind: 'assistant', id: first.id, text: folded.text, steps }]
}

function createConversationRows(
  labels: StepLabels
): (messages: readonly Message[]) => readonly Row[] {
  const toEntry = (step: RawStep): LogEntry => ({
    id: step.id,
    status: step.settled ? 'success' : 'calling',
    text: step.settled ? labels.done(step.toolName) : labels.calling(step.toolName),
    toolName: step.toolName,
    ...(step.meta === undefined ? {} : { meta: step.meta })
  })

  return (messages) =>
    groupTurns(messages).flatMap((turn) => [...userRow(turn), ...assistantRow(turn, toEntry)])
}

export { createConversationRows }
export type { Row, UserRow, AssistantRow, StepLabels }
