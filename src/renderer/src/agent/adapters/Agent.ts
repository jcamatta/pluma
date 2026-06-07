// Renderer AG-UI agent: an AbstractAgent whose run() bridges window.api to an Observable of AG-UI
// events. startRun (private) invokes AGENT_RUN_CHANNEL and resolves the minted runId; onEvent (private)
// subscribes to AGENT_EVENT_CHANNEL; abortRun (private) invokes AGENT_ABORT_CHANNEL. run() subscribes
// to the event stream, routes each event (forward / finish on RUN_FINISHED / error on RUN_ERROR) via
// the pure routeAgentEvent, and on teardown unsubscribes and aborts the run if still in flight.
// window.api is injected (defaulting to the global) so tests pass a fake. Lives under adapters/ for IPC.

import {
  AbstractAgent,
  type RunAgentInput,
  type RunAgentParameters,
  type RunAgentResult
} from '@ag-ui/client'
import type { AgentSubscriber } from '@ag-ui/client'
import type { BaseEvent, Tool } from '@ag-ui/core'
import { Observable, type Subscriber } from 'rxjs'
import { AGENT_ABORT_CHANNEL, AGENT_RUN_CHANNEL } from '../../../../shared/ipc/ipc-contract/agent'
import { AGENT_EVENT_CHANNEL } from '../../../../shared/ipc/ipc-event-contract/agent'
import type { WindowApi } from '../../../../shared/ipc/window-api'
import { routeAgentEvent } from '../route-agent-event'
import { toRunInput } from '../to-run-input'

type StartRunResult = { ok: true; runId: string } | { ok: false; error: string }

interface RunState {
  runId: string | undefined
  done: boolean
}

export class Agent extends AbstractAgent {
  private readonly api: WindowApi
  private readonly tools: () => readonly Tool[]

  constructor(api: WindowApi = window.api, tools: () => readonly Tool[] = () => []) {
    super()
    this.api = api
    this.tools = tools
  }

  override runAgent(
    parameters?: RunAgentParameters,
    subscriber?: AgentSubscriber
  ): Promise<RunAgentResult> {
    const tools = parameters?.tools ?? [...this.tools()]
    return super.runAgent({ ...parameters, tools }, subscriber)
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const state: RunState = { runId: undefined, done: false }
      const off = this.onEvent((event) => {
        if (!state.done && emitEvent(subscriber, event)) state.done = true
      })

      this.startRun(input)
        .then((result) => {
          if (result.ok) state.runId = result.runId
          else subscriber.error(new Error(result.error))
        })
        .catch((error: unknown) => subscriber.error(error))

      return () => {
        off()
        if (!state.done && state.runId !== undefined) this.abortRunById(state.runId)
      }
    })
  }

  // The three IPC operations the run bridges, as protected seams: production talks to window.api; tests
  // subclass and override these, so no fake of the channel-generic WindowApi is needed.
  protected startRun(input: RunAgentInput): Promise<StartRunResult> {
    return this.api
      .invoke(AGENT_RUN_CHANNEL, toRunInput(input))
      .then((result) =>
        result.ok
          ? { ok: true, runId: result.value.runId }
          : { ok: false, error: result.error._tag }
      )
  }

  protected abortRunById(runId: string): void {
    void this.api.invoke(AGENT_ABORT_CHANNEL, runId)
  }

  protected onEvent(listener: (event: BaseEvent) => void): () => void {
    return this.api.on(AGENT_EVENT_CHANNEL, listener)
  }
}

// Forwards/terminates one event onto the subscriber; returns true once the run is finished (complete
// or error) so the caller stops processing further events.
function emitEvent(subscriber: Subscriber<BaseEvent>, event: BaseEvent): boolean {
  const outcome = routeAgentEvent(event)
  if (outcome.kind === 'next') {
    subscriber.next(outcome.event)
    return false
  }
  if (outcome.kind === 'finish') subscriber.complete()
  else subscriber.error(new Error(outcome.message))
  return true
}

export type { StartRunResult }
