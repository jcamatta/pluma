// ConversationView is pure: it renders each projected row as a user bubble or an assistant row, attaches
// the scroll ref to the matching user bubble, and resolves each assistant row's expanded state from the
// overrides map (falling back to the status default). Toggling flips the effective state through onSetExpanded.

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConversationView } from '../Conversation.view'
import type { RenderRow } from '../conversation-render'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: { title: 'Run failed' },
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

const rows: readonly RenderRow[] = [
  { row: { kind: 'user', id: 'u1', text: 'what is my name?' }, status: 'done' },
  {
    row: {
      kind: 'assistant',
      id: 'a1',
      text: 'Your name is Joel.',
      steps: [{ id: 'c1', status: 'success', text: 'Used read', toolName: 'read' }]
    },
    status: 'done'
  }
]

function renderConversation(overrides = new Map<string, boolean>()): {
  onSetExpanded: ReturnType<typeof vi.fn>
} {
  const onSetExpanded = vi.fn()
  render(
    <ConversationView
      rows={rows}
      labels={labels}
      overrides={overrides}
      onSetExpanded={onSetExpanded}
      scrollRefId="u1"
      scrollRef={createRef<HTMLDivElement>()}
    />
  )
  return { onSetExpanded }
}

describe('ConversationView', () => {
  it('renders the user bubble and the assistant reply', () => {
    renderConversation()
    expect(screen.getByText('what is my name?')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-reply')).toHaveTextContent('Your name is Joel.')
  })

  it('a settled assistant row is collapsed by default (its step row is hidden)', () => {
    renderConversation()
    expect(screen.queryByText('Used read')).not.toBeInTheDocument()
  })

  it('an override expands the row, revealing its steps', () => {
    renderConversation(new Map([['a1', true]]))
    expect(screen.getByText('Used read')).toBeInTheDocument()
  })

  it('toggling the header asks to set the opposite of the effective expanded state', () => {
    const { onSetExpanded } = renderConversation()
    fireEvent.click(screen.getByRole('button', { name: /Worked/ }))
    expect(onSetExpanded).toHaveBeenCalledWith('a1', true)
  })
})
