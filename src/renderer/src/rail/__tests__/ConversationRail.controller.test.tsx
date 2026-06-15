// ConversationRailController is the rail switch; in the chat view it renders the whole conversation
// directly from agent.messages — every turn (current and prior) becomes a user bubble and a grouped
// assistant row carrying its reply and derived step timeline. "Working" is driven by agent.isRunning, a
// failed run by onRunFailed; neither adds a message. A fake AbstractAgent holds real messages (addMessage
// fires onMessagesChanged; setMessages clears) and lets the test drive run status, settle messages, and
// fail a run. The threads repository is the in-memory fake and the thread controls are bound to the fake
// agent — no IPC.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { type BaseEvent, type Message, type State } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { AgentContext } from '../../agent/AgentContext'
import { AgentApprovalsProvider } from '../../agent/AgentApprovalsProvider'
import { ThreadControlsContext } from '../../agent/ThreadControlsContext'
import { ThreadsContext } from '../../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../../threads/__tests__/fake-threads-repository'
import { ActiveEditorProvider } from '../../editor/ActiveEditorProvider'
import { i18n } from '../../i18n'
import { ConversationRailController } from '../ConversationRail.controller'

const BLANK_INPUT: RunAgentInput = {
  threadId: '',
  runId: '',
  messages: [],
  tools: [],
  context: [],
  forwardedProps: {},
  state: {}
}

class FakeAgent extends AbstractAgent {
  private subs: readonly AgentSubscriber[] = []
  runs = 0
  aborts = 0

  run(input: RunAgentInput): Observable<BaseEvent> {
    void input
    return new Observable<BaseEvent>((subscriber) => subscriber.complete())
  }

  override subscribe(sub: AgentSubscriber): { unsubscribe: () => void } {
    this.subs = [...this.subs, sub]
    return { unsubscribe: () => (this.subs = this.subs.filter((s) => s !== sub)) }
  }

  override addMessage(message: Message): void {
    this.messages = [...this.messages, message]
    for (const sub of this.subs) {
      void sub.onNewMessage?.({ message, messages: this.messages, state: {}, agent: this })
    }
    this.notifyMessages()
  }

  override setMessages(messages: Message[]): void {
    this.messages = messages
    this.notifyMessages()
  }

  override runAgent(): ReturnType<AbstractAgent['runAgent']> {
    this.runs += 1
    return Promise.resolve({ result: undefined, newMessages: [] })
  }

  override abortRun(): void {
    this.aborts += 1
  }

  // The run pipeline folds streamed text and tool activity into agent.messages; the test appends those
  // settled messages directly (an assistant turn, a tool result) to mirror that.
  settle(message: Message): void {
    this.messages = [...this.messages, message]
    this.notifyMessages()
  }

  // agent.isRunning drives "working"; flipping it notifies onStateChanged so the rail re-renders.
  setRunning(running: boolean): void {
    this.isRunning = running
    for (const sub of this.subs) {
      void sub.onStateChanged?.({ messages: this.messages, state: {}, agent: this })
    }
  }

  fail(): void {
    for (const sub of this.subs) {
      void sub.onRunFailed?.({
        error: new Error('boom'),
        messages: this.messages,
        state: {},
        agent: this,
        input: BLANK_INPUT
      })
    }
  }

  // The backend publishes context usage onto the shared state; drive onStateChanged the same way so the
  // composer's context meter updates.
  emitState(state: State): void {
    for (const sub of this.subs) {
      void sub.onStateChanged?.({ messages: this.messages, state, agent: this })
    }
  }

  private notifyMessages(): void {
    for (const sub of this.subs) {
      void sub.onMessagesChanged?.({ messages: this.messages, state: {}, agent: this })
    }
  }
}

function renderRail(agent: FakeAgent = new FakeAgent()): { agent: FakeAgent } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const controls = {
    seedThread: (_id: string, messages: readonly Message[]) => agent.setMessages([...messages]),
    newThread: () => agent.setMessages([]),
    currentThreadId: (): string | undefined => undefined,
    seedContext: (): void => undefined
  }
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThreadsContext.Provider value={createFakeThreadsRepository({})}>
          <AgentContext.Provider value={agent}>
            <ThreadControlsContext.Provider value={controls}>
              <AgentApprovalsProvider>
                <ActiveEditorProvider>
                  <ConversationRailController cwd="/work" onClose={() => undefined} />
                </ActiveEditorProvider>
              </AgentApprovalsProvider>
            </ThreadControlsContext.Provider>
          </AgentContext.Provider>
        </ThreadsContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  return { agent }
}

function send(text: string): void {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /send/i }))
}

// A full text turn: open the run, settle the assistant reply into agent.messages, finish.
function runTurn(agent: FakeAgent, reply: string): void {
  act(() => {
    agent.setRunning(true)
    agent.settle({ id: `a-${agent.runs}`, role: 'assistant', content: reply })
    agent.setRunning(false)
  })
}

afterEach(() => vi.restoreAllMocks())

describe('ConversationRailController rendering', () => {
  it('shows the empty state before the first message', () => {
    renderRail()
    expect(screen.getByText(i18n.t('rail.newChatEmpty'))).toBeInTheDocument()
  })

  it('runs a turn on send: adds the user message, starts a run, renders the bubble, clears composer', () => {
    const { agent } = renderRail()

    send('  fix my prose  ')

    expect(agent.messages).toEqual([
      { id: expect.any(String), role: 'user', content: 'fix my prose' }
    ])
    expect(agent.runs).toBe(1)
    // The prompt shows in both the chat header title and the turn's user bubble.
    expect(screen.getAllByText('fix my prose')).toHaveLength(2)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('does not send empty or whitespace-only text', () => {
    const { agent } = renderRail()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true })

    expect(agent.runs).toBe(0)
  })

  it('keeps every prior turn visible across turns (no overwrite on the second send)', () => {
    const { agent } = renderRail()

    send('what is my name?')
    runTurn(agent, 'Your name is Joel.')

    send('another message')

    // The first turn's question and answer survive the second send as a prior row; the title stays the
    // first message ('what is my name?' shows in its bubble and in the header).
    expect(screen.getByText('Your name is Joel.')).toBeInTheDocument()
    expect(screen.getAllByText('what is my name?')).toHaveLength(2)
    expect(screen.getByText('another message')).toBeInTheDocument()
  })
})

describe('ConversationRailController run lifecycle', () => {
  it('renders a tool turn with its step timeline and reply, and aborts on Stop', () => {
    const { agent } = renderRail()
    send('revise')

    // While the run works the composer offers Stop; clicking it aborts.
    act(() => agent.setRunning(true))
    fireEvent.click(screen.getByRole('button', { name: i18n.t('rail.stop') }))
    expect(agent.aborts).toBe(1)

    // The turn settles into messages: a tool call, its result, then the reply.
    act(() => {
      agent.settle({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 't1', type: 'function', function: { name: 'propose_edit', arguments: '{}' } }
        ]
      })
      agent.settle({ id: 'r1', role: 'tool', toolCallId: 't1', content: 'ok' })
      agent.settle({ id: 'a2', role: 'assistant', content: 'Done.' })
      agent.setRunning(false)
    })

    // The grouped row shows the settled "Worked" header (the turn used a tool) and the streamed reply.
    expect(screen.getByText('Done.')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('rail.worked'))).toBeInTheDocument()
  })

  it('shows the run-failed affordance when a run fails', () => {
    const { agent } = renderRail()
    send('revise')

    act(() => {
      agent.setRunning(true)
      agent.fail()
      agent.setRunning(false)
    })

    expect(screen.getByText(i18n.t('rail.runFailed'))).toBeInTheDocument()
  })

  it('scrolls the sent message into view, but not on assistant streaming', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { agent } = renderRail()

    // The user bubble mounts when the message is sent — that is when it is scrolled into view.
    act(() => send('revise'))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    // A settled assistant reply does not move the last user message → no re-scroll.
    act(() => agent.settle({ id: 'a1', role: 'assistant', content: 'Done.' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('clears the conversation on new chat', () => {
    const { agent } = renderRail()
    send('hello')
    expect(screen.getAllByText('hello').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: i18n.t('rail.newChat') }))

    expect(agent.messages).toEqual([])
    expect(screen.getByText(i18n.t('rail.newChatEmpty'))).toBeInTheDocument()
  })
})

describe('ConversationRailController context meter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the context meter in the composer once a usage snapshot arrives', () => {
    const { agent } = renderRail()
    expect(screen.queryByTestId('context-meter')).toBeNull()

    act(() =>
      agent.emitState({
        contextUsage: {
          usedTokens: 60_000,
          windowTokens: 1_000_000,
          breakdown: { inputTokens: 60_000, cacheReadTokens: 0, cacheCreationTokens: 0 }
        }
      })
    )

    expect(screen.getByRole('button', { name: /context/i })).toBeInTheDocument()
  })
})
