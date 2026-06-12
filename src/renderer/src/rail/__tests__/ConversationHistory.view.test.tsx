// ConversationHistoryView is pure: it renders the loading and error states, omits non-text roles, and
// renders user bubbles + assistant blocks for a loaded transcript. No IPC.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Message } from '@ag-ui/core'
import { ConversationHistoryView } from '../ConversationHistory.view'

const labels = { loading: 'Loading…', error: 'Could not load this chat.' }

describe('ConversationHistoryView', () => {
  it('shows the loading state', () => {
    render(<ConversationHistoryView loading failed={false} messages={[]} labels={labels} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    render(<ConversationHistoryView loading={false} failed messages={[]} labels={labels} />)
    expect(screen.getByText('Could not load this chat.')).toBeInTheDocument()
  })

  it('renders the user and assistant messages of a loaded transcript', () => {
    const messages: readonly Message[] = [
      { id: 'm1', role: 'user', content: 'Review my intro' },
      { id: 'm2', role: 'assistant', content: 'Here is a tighter draft.' }
    ]
    render(
      <ConversationHistoryView loading={false} failed={false} messages={messages} labels={labels} />
    )
    expect(screen.getByTestId('thread-transcript')).toBeInTheDocument()
    expect(screen.getByText('Review my intro')).toBeInTheDocument()
    expect(screen.getByText('Here is a tighter draft.')).toBeInTheDocument()
  })
})
