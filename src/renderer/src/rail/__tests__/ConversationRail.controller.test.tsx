// ConversationRailController is the rail switch; in the chat view it renders agent.messages as the
// conversation: settled turns stack as history above the current turn, whose assistant side is the live
// activity. Submitting adds the user message and starts a run; new chat clears the conversation. A fake
// AbstractAgent holds real messages (addMessage fires onNewMessage so the activity resets per turn;
// setMessages clears) and lets the test drive AG-UI events and settle replies. The threads repository is
// the in-memory fake and the thread controls are bound to the fake agent — no IPC.

import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { EventType, type BaseEvent, type Message } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { AgentContext } from '../../agent/AgentContext'
import { ThreadControlsContext } from '../../agent/ThreadControlsContext'
import { ThreadsContext } from '../../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../../threads/__tests__/fake-threads-repository'
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

// Events arrive as full AGUIEvents at runtime; the test builds terse literals carrying only the fields
// the reducer reads. BaseEvent is a passthrough object, so these literals type as BaseEvent — no cast.
const event = (literal: BaseEvent): BaseEvent => literal

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

  // Simulate the run pipeline folding the streamed assistant reply into agent.messages.
  settle(message: Message): void {
    this.messages = [...this.messages, message]
    this.notifyMessages()
  }

  emit(payload: BaseEvent): void {
    for (const sub of this.subs) {
      void sub.onEvent?.({
        event: payload,
        messages: this.messages,
        state: {},
        agent: this,
        input: BLANK_INPUT
      })
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
    newThread: () => agent.setMessages([])
  }
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThreadsContext.Provider value={createFakeThreadsRepository({})}>
          <AgentContext.Provider value={agent}>
            <ThreadControlsContext.Provider value={controls}>
              <ConversationRailController cwd="/work" onClose={() => undefined} />
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

// A full turn: open the run, stream the reply into the activity, settle it into agent.messages, finish.
function runTurn(agent: FakeAgent, reply: string): void {
  act(() => {
    agent.emit(event({ type: EventType.RUN_STARTED }))
    agent.emit(event({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm', delta: reply }))
    agent.settle({ id: `a-${agent.runs}`, role: 'assistant', content: reply })
    agent.emit(event({ type: EventType.RUN_FINISHED }))
  })
}

describe('ConversationRailController', () => {
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

    // The first turn's question and answer survive the second send as history; the title stays the
    // first message ('what is my name?' shows in its history bubble and in the header).
    expect(screen.getByText('Your name is Joel.')).toBeInTheDocument()
    expect(screen.getAllByText('what is my name?')).toHaveLength(2)
    expect(screen.getByText('another message')).toBeInTheDocument()
  })

  it('folds the run events into the current turn and aborts on Stop', () => {
    const { agent } = renderRail()
    send('revise')

    act(() => {
      agent.emit(event({ type: EventType.RUN_STARTED }))
      agent.emit(
        event({ type: EventType.TOOL_CALL_START, toolCallId: 't1', toolCallName: 'propose_edit' })
      )
    })

    // The in-turn Stop button is present while the run works; clicking it aborts.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('rail.stop') }))
    expect(agent.aborts).toBe(1)

    act(() => {
      agent.emit(event({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Done.' }))
      agent.emit(event({ type: EventType.RUN_FINISHED }))
    })

    expect(screen.getByText('Done.')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('rail.worked'))).toBeInTheDocument()
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
