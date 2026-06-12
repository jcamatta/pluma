// ConversationRailController owns the composer value and the current turn, and runs a turn against the
// live agent: submitting adds the user message and starts a run, the run's events fold into the turn's
// activity, and the user bubble + reply render. A fake AbstractAgent records addMessage/runAgent/abortRun
// and lets the test drive AG-UI events through the subscriber — no IPC. i18n returns the real en strings.

import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { AbstractAgent, type AgentSubscriber, type RunAgentInput } from '@ag-ui/client'
import { EventType, type BaseEvent, type Message } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { AgentContext } from '../../agent/AgentContext'
import { i18n } from '../../i18n'
import { ConversationRailController } from '../ConversationRail.controller'

// Events arrive as full AGUIEvents at runtime; the test builds terse literals carrying only the fields
// the reducer reads. BaseEvent is a passthrough object (open to extra fields), so these literals type
// as BaseEvent directly — no cast. The base shape (a `type` field) always holds.
const event = (literal: BaseEvent): BaseEvent => literal

class FakeAgent extends AbstractAgent {
  private sub: AgentSubscriber | undefined
  readonly added: Message[] = []
  runs = 0
  aborts = 0

  run(input: RunAgentInput): Observable<BaseEvent> {
    void input
    return new Observable<BaseEvent>((subscriber) => subscriber.complete())
  }

  override subscribe(sub: AgentSubscriber): { unsubscribe: () => void } {
    this.sub = sub
    return { unsubscribe: () => (this.sub = undefined) }
  }

  override addMessage(message: Message): void {
    this.added.push(message)
  }

  override runAgent(): ReturnType<AbstractAgent['runAgent']> {
    this.runs += 1
    return Promise.resolve({ result: undefined, newMessages: [] })
  }

  override abortRun(): void {
    this.aborts += 1
  }

  emit(event: BaseEvent): void {
    void this.sub?.onEvent?.({
      event,
      messages: [],
      state: {},
      agent: this,
      input: {
        threadId: '',
        runId: '',
        messages: [],
        tools: [],
        context: [],
        forwardedProps: {},
        state: {}
      }
    })
  }
}

function renderRail(agent: FakeAgent = new FakeAgent()): { agent: FakeAgent } {
  render(
    <I18nextProvider i18n={i18n}>
      <AgentContext.Provider value={agent}>
        <ConversationRailController cwd="/work" onClose={() => undefined} />
      </AgentContext.Provider>
    </I18nextProvider>
  )
  return { agent }
}

function send(text: string): void {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /send/i }))
}

describe('ConversationRailController', () => {
  it('shows the empty state before the first message', () => {
    renderRail()
    expect(screen.getByText(i18n.t('rail.newChatEmpty'))).toBeInTheDocument()
  })

  it('runs a turn on send: adds the user message, starts a run, renders the bubble, clears composer', () => {
    const { agent } = renderRail()

    send('  fix my prose  ')

    expect(agent.added).toEqual([{ id: expect.any(String), role: 'user', content: 'fix my prose' }])
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

  it('folds the run events into the turn and aborts on Stop', () => {
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
})
