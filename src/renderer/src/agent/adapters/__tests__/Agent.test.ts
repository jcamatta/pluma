// Agent.run: bridges the IPC seams to an Observable — forwards events, completes on RUN_FINISHED,
// errors on RUN_ERROR, and on unsubscribe both detaches the event listener and aborts an in-flight run.
// A TestAgent subclass overrides the three protected IPC methods, so no fake of the channel-generic
// window.api is needed.

import { describe, expect, it, vi } from 'vitest'
import { EventType, type BaseEvent } from '@ag-ui/core'
import type { RunAgentInput } from '@ag-ui/client'
import { Agent, type StartRunResult } from '../Agent'

class TestAgent extends Agent {
  readonly listeners = new Set<(event: BaseEvent) => void>()
  readonly off = vi.fn()
  readonly aborted = vi.fn()
  readonly resumeIds: string[] = []
  start: StartRunResult = { ok: true, runId: 'run-1' }

  emit(event: BaseEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  protected override startRun(): Promise<StartRunResult> {
    this.resumeIds.push(this.resumeThreadId())
    return Promise.resolve(this.start)
  }

  protected override abortRunById(runId: string): void {
    this.aborted(runId)
  }

  protected override onEvent(listener: (event: BaseEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      this.off()
    }
  }
}

const input: RunAgentInput = {
  threadId: '',
  runId: '',
  messages: [],
  tools: [],
  context: [],
  forwardedProps: {},
  state: {}
}

describe('Agent.run', () => {
  it('forwards events and completes on RUN_FINISHED', () => {
    const agent = new TestAgent()
    const seen: BaseEvent[] = []
    const completed = vi.fn()

    agent.run(input).subscribe({ next: (event) => seen.push(event), complete: completed })
    agent.emit({ type: EventType.TEXT_MESSAGE_CONTENT })
    agent.emit({ type: EventType.RUN_FINISHED })

    expect(seen).toEqual([{ type: EventType.TEXT_MESSAGE_CONTENT }])
    expect(completed).toHaveBeenCalledOnce()
  })

  it('errors on RUN_ERROR and stops forwarding', () => {
    const agent = new TestAgent()
    const errored = vi.fn()
    const next = vi.fn()

    agent.run(input).subscribe({ next, error: errored })
    agent.emit({ type: EventType.RUN_ERROR, message: 'boom' })
    agent.emit({ type: EventType.TEXT_MESSAGE_CONTENT })

    expect(errored).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()
  })

  it('detaches the listener on unsubscribe', () => {
    const agent = new TestAgent()

    const subscription = agent.run(input).subscribe({ next: () => undefined })
    subscription.unsubscribe()

    expect(agent.off).toHaveBeenCalledOnce()
  })

  it('opens a fresh session on the first run, then resumes the SDK session id main reports', () => {
    const agent = new TestAgent()

    // First turn: no session yet, so nothing to resume (a fresh session opens).
    agent.run(input).subscribe({ next: () => undefined })
    expect(agent.resumeIds).toEqual([''])

    // Main reports the real SDK session id via RUN_STARTED.threadId; the next turn must resume that —
    // never AG-UI's own random threadId, which the SDK would reject as an unknown session.
    agent.emit({ type: EventType.RUN_STARTED, threadId: 'sdk-session-7' })
    agent.run(input).subscribe({ next: () => undefined })
    expect(agent.resumeIds).toEqual(['', 'sdk-session-7'])
  })

  it('aborts an in-flight run on unsubscribe once the runId is known', async () => {
    const agent = new TestAgent()

    const subscription = agent.run(input).subscribe({ next: () => undefined })
    await Promise.resolve() // let startRun resolve so the runId is recorded
    subscription.unsubscribe()

    expect(agent.aborted).toHaveBeenCalledWith('run-1')
  })

  // Stop calls abortRun(). The base class's abortRun() is a no-op, so without our override the run keeps
  // streaming. The override stops it through the base class's documented teardown trigger,
  // detachActiveRun(), which completes the run's takeUntil pipe — unsubscribing run() so its teardown
  // fires the abort (the unsubscribe path covered above) and settles isRunning.
  it('stops the active run by detaching it when abortRun is called', () => {
    const agent = new TestAgent()
    const detach = vi.spyOn(agent, 'detachActiveRun').mockResolvedValue(undefined)

    agent.abortRun()

    expect(detach).toHaveBeenCalledOnce()
  })

  it('abortRun with no active run is a no-op that does not throw or abort', () => {
    const agent = new TestAgent()

    expect(() => agent.abortRun()).not.toThrow()
    expect(agent.aborted).not.toHaveBeenCalled()
  })
})
