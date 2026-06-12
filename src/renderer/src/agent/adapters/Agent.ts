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
import { EventType, type BaseEvent, type Tool } from '@ag-ui/core'
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
  // The open workspace folder, set by the provider as the folder changes and stamped into
  // forwardedProps when a run starts so the backend keys the SDK session under it. Mutable like
  // sessionId below — the provider pushes the latest value via setCwd; undefined before a folder opens.
  private workspaceCwd: string | undefined = undefined
  // The Claude SDK session to resume on the next turn. AbstractAgent mints its own random threadId, but
  // the SDK only knows the session id it reports back via RUN_STARTED.threadId. We start with none (so
  // the first turn opens a fresh session) and adopt the reported id so later turns resume the same one —
  // never sending AG-UI's threadId as a `resume`, which would fail with "No conversation found".
  private sessionId: string | undefined = undefined

  constructor(api: WindowApi = window.api, tools: () => readonly Tool[] = () => []) {
    super()
    this.api = api
    this.tools = tools
  }

  // Push the open workspace folder in; the next run stamps it onto forwardedProps. Called by the
  // provider as the picked folder changes.
  setCwd(cwd: string | undefined): void {
    this.workspaceCwd = cwd
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
        this.adoptSession(event)
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
  // Records the real SDK session id the first RUN_STARTED reports, so the next turn resumes it. Reading
  // `threadId` off the event keeps this tied to main's source of truth (system/init.session_id).
  private adoptSession(event: BaseEvent): void {
    if (event.type !== EventType.RUN_STARTED || !('threadId' in event)) return
    const reported = event.threadId
    if (typeof reported === 'string' && reported.length > 0) this.sessionId = reported
  }

  // The threadId to send for the next run: the SDK session id once we have one (so the turn resumes it),
  // else empty (toRunInput omits it and a fresh session opens). Protected so tests can read the choice.
  protected resumeThreadId(): string {
    return this.sessionId ?? ''
  }

  protected startRun(input: RunAgentInput): Promise<StartRunResult> {
    // Send the SDK session id (when we have one) as the threadId, not AG-UI's random one — only a real
    // session can be resumed. The first turn has none, so toRunInput omits it and a fresh session opens.
    // Stamp the workspace cwd onto forwardedProps so toRunInput lifts it onto the IPC input.
    const cwd = this.workspaceCwd
    const forwardedProps =
      cwd === undefined ? input.forwardedProps : { ...input.forwardedProps, cwd }
    return this.api
      .invoke(
        AGENT_RUN_CHANNEL,
        toRunInput({ ...input, threadId: this.resumeThreadId(), forwardedProps })
      )
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
