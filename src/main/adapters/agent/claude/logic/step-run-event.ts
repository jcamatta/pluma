// Calculation: fold one Claude SDK message into AG-UI events (@ag-ui/core), carrying run state in an
// accumulator. system/init opens the run (RUN_STARTED) and fixes the threadId; stream_event becomes
// text/tool deltas; a user message becomes tool results; result closes the run (RUN_FINISHED). threadId
// and the open-block map live in the accumulator, so the fold needs no shared mutation.

import { EventType, type BaseEvent } from '@ag-ui/core'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { OpenBlock } from '../data/sdk-types'
import { toolResultEvents } from './tool-result-events'
import { transformStreamEvent } from './transform-stream-event'

export interface RunAccumulator {
  readonly threadId: string
  readonly blocks: Map<number, OpenBlock>
}

const newRunAccumulator = (): RunAccumulator => ({ threadId: '', blocks: new Map() })

const stepRunEvent =
  (runId: string) =>
  (acc: RunAccumulator, message: SDKMessage): readonly [RunAccumulator, readonly BaseEvent[]] => {
    if (message.type === 'system' && message.subtype === 'init') {
      const threadId = message.session_id
      return [{ ...acc, threadId }, [{ type: EventType.RUN_STARTED, threadId, runId }]]
    }
    if (message.type === 'stream_event') {
      const event = transformStreamEvent(message.event, acc.blocks)
      return [acc, event ? [event] : []]
    }
    if (message.type === 'user') return [acc, toolResultEvents(message.message.content)]
    if (message.type === 'result') {
      const finished: BaseEvent = {
        type: EventType.RUN_FINISHED,
        threadId: acc.threadId,
        runId,
        outcome: { type: 'success' }
      }
      return [acc, [finished]]
    }
    return [acc, []]
  }

export { newRunAccumulator, stepRunEvent }
