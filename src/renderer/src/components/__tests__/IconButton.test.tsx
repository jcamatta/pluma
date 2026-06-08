// IconButton is a pure visual primitive: it renders an accessible button, fires onClick, optionally
// stops click propagation to a parent, and merges a caller className over its base styling.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { IconButton } from '../IconButton'

describe('IconButton', () => {
  it('renders an accessible button and fires onClick', () => {
    const onClick = vi.fn()
    render(
      <IconButton label="Add" onClick={onClick}>
        <span>icon</span>
      </IconButton>
    )
    fireEvent.click(screen.getByLabelText('Add'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not stop propagation by default', () => {
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <IconButton label="Add" onClick={() => undefined}>
          <span>icon</span>
        </IconButton>
      </div>
    )
    fireEvent.click(screen.getByLabelText('Add'))
    expect(onParentClick).toHaveBeenCalledOnce()
  })

  it('stops propagation to a parent when stopPropagation is set', () => {
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <IconButton label="Delete" onClick={() => undefined} stopPropagation>
          <span>icon</span>
        </IconButton>
      </div>
    )
    fireEvent.click(screen.getByLabelText('Delete'))
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('merges a caller className over the base styling', () => {
    render(
      <IconButton label="Collapse" onClick={() => undefined} className="rounded-lg">
        <span>icon</span>
      </IconButton>
    )
    const button = screen.getByLabelText('Collapse')
    expect(button.className).toContain('rounded-lg')
    expect(button.className).not.toContain('rounded-md')
  })
})
