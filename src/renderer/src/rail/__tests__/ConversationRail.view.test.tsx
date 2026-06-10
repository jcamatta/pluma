// ConversationRailView is pure: it renders the chat header + composer + empty state from props and
// fires callbacks on interaction. No hooks, no IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConversationRailView, type RailLabels } from '../ConversationRail.view'

const labels: RailLabels = {
  chats: 'Chats',
  newChat: 'New chat',
  collapse: 'Collapse panel',
  newChatEmpty: 'Ask the assistant.',
  composerPlaceholder: 'Ask anything…',
  send: 'Send',
  toSend: 'to send'
}

const noop = (): void => undefined

const baseProps = {
  labels,
  title: 'New chat',
  hasTurn: false,
  value: '',
  onChange: noop,
  onSubmit: noop,
  onNewChat: noop,
  onClose: noop
}

describe('ConversationRailView', () => {
  it('shows the empty state when there is no turn', () => {
    render(<ConversationRailView {...baseProps} />)
    expect(screen.getByText('Ask the assistant.')).toBeInTheDocument()
  })

  it('renders the turn slot instead of the empty state when a turn is present', () => {
    render(
      <ConversationRailView {...baseProps} hasTurn>
        <div>turn content</div>
      </ConversationRailView>
    )
    expect(screen.getByText('turn content')).toBeInTheDocument()
    expect(screen.queryByText('Ask the assistant.')).not.toBeInTheDocument()
  })

  it('disables Send until the composer has non-whitespace text', () => {
    const { rerender } = render(<ConversationRailView {...baseProps} value="   " />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    rerender(<ConversationRailView {...baseProps} value="hello" />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('submits on Send click and on ⌘/Ctrl+Enter', () => {
    const onSubmit = vi.fn()
    render(<ConversationRailView {...baseProps} value="hello" onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.keyDown(screen.getByPlaceholderText('Ask anything…'), {
      key: 'Enter',
      metaKey: true
    })

    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('reports composer edits through onChange', () => {
    const onChange = vi.fn()
    render(<ConversationRailView {...baseProps} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything…'), { target: { value: 'hi' } })
    expect(onChange).toHaveBeenCalledWith('hi')
  })

  it('fires onNewChat and onClose from the header buttons', () => {
    const onNewChat = vi.fn()
    const onClose = vi.fn()
    render(<ConversationRailView {...baseProps} onNewChat={onNewChat} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))

    expect(onNewChat).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
