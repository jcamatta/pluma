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
  toSend: 'to send',
  stop: 'Stop',
  chatTab: 'Chat',
  reviewTab: 'Review'
}

const noop = (): void => undefined

const baseProps = {
  labels,
  title: 'New chat',
  hasTurn: false,
  working: false,
  value: '',
  onChange: noop,
  onSubmit: noop,
  onStop: noop,
  onNewChat: noop,
  onShowThreads: noop,
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

  it('swaps Send for Stop while a run is in flight, and fires onStop', () => {
    const onStop = vi.fn()
    const onSubmit = vi.fn()
    render(
      <ConversationRailView
        {...baseProps}
        working
        value="hello"
        onStop={onStop}
        onSubmit={onSubmit}
      />
    )

    // The action slot is Stop, not Send; ⌘↵ no longer resubmits while working.
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText('Ask anything…'), { key: 'Enter', metaKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('reports composer edits through onChange', () => {
    const onChange = vi.fn()
    render(<ConversationRailView {...baseProps} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything…'), { target: { value: 'hi' } })
    expect(onChange).toHaveBeenCalledWith('hi')
  })

  it('fires onShowThreads, onNewChat and onClose from the header buttons', () => {
    const onShowThreads = vi.fn()
    const onNewChat = vi.fn()
    const onClose = vi.fn()
    render(
      <ConversationRailView
        {...baseProps}
        onShowThreads={onShowThreads}
        onNewChat={onNewChat}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chats' }))
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))

    expect(onShowThreads).toHaveBeenCalledOnce()
    expect(onNewChat).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ConversationRailView · tabs', () => {
  it('shows the review slot and hides the composer on the Review tab', () => {
    render(<ConversationRailView {...baseProps} tab="review" review={<div>review content</div>} />)

    expect(screen.getByText('review content')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ask anything…')).not.toBeInTheDocument()
  })

  it('fires onTab when the Review tab is clicked, and badges the artifact count', () => {
    const onTab = vi.fn()
    render(<ConversationRailView {...baseProps} onTab={onTab} reviewCount={3} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))
    expect(onTab).toHaveBeenCalledWith('review')
  })
})
