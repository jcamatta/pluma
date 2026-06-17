// ThreadTitleInput is a stateful leaf: it seeds with the current title, commits the trimmed value on
// Enter or blur, cancels on Escape, and commits/cancels at most once. No IPC.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThreadTitleInput } from '../ThreadTitleInput'

describe('ThreadTitleInput', () => {
  it('commits the trimmed value on Enter', () => {
    const onCommit = vi.fn()
    render(<ThreadTitleInput initialValue="Old" onCommit={onCommit} onCancel={vi.fn()} />)
    const field = screen.getByDisplayValue('Old')
    fireEvent.change(field, { target: { value: '  New  ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('New')
  })

  it('cancels on Escape without committing', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(<ThreadTitleInput initialValue="Old" onCommit={onCommit} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByDisplayValue('Old'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits only once across Enter then blur', () => {
    const onCommit = vi.fn()
    render(<ThreadTitleInput initialValue="Old" onCommit={onCommit} onCancel={vi.fn()} />)
    const field = screen.getByDisplayValue('Old')
    fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.blur(field)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('carries the focus-ring opt-out hook so its accent border is not doubled by the global outline', () => {
    render(<ThreadTitleInput initialValue="Old" onCommit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByDisplayValue('Old')).toHaveAttribute('data-thread-title-input')
  })
})
