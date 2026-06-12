// ComposerField is the composer's growing textarea: it forwards typing/keys and keeps the textarea
// overflow-hidden inside a Scrollable so the Base UI ScrollArea owns the wheel once it overflows.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ComposerField } from '../ComposerField'

function renderField(overrides = {}): {
  onChange: ReturnType<typeof vi.fn>
  onKeyDown: ReturnType<typeof vi.fn>
} {
  const onChange = vi.fn()
  const onKeyDown = vi.fn()
  render(
    <ComposerField
      placeholder="Ask…"
      value=""
      onChange={onChange}
      onKeyDown={onKeyDown}
      {...overrides}
    />
  )
  return { onChange, onKeyDown }
}

describe('ComposerField', () => {
  it('forwards typed text through onChange', () => {
    const { onChange } = renderField()

    fireEvent.change(screen.getByPlaceholderText('Ask…'), { target: { value: 'hi' } })
    expect(onChange).toHaveBeenCalledWith('hi')
  })

  it('forwards key events (so ⌘/Ctrl+Enter submit still reaches the composer)', () => {
    const { onKeyDown } = renderField()

    fireEvent.keyDown(screen.getByPlaceholderText('Ask…'), { key: 'Enter', metaKey: true })
    expect(onKeyDown).toHaveBeenCalledOnce()
  })

  it('keeps the textarea overflow-hidden so the Scrollable owns the wheel at max height', () => {
    renderField()

    const textarea = screen.getByPlaceholderText('Ask…')
    expect(textarea.className).toContain('overflow-hidden')
    expect(textarea.className).not.toContain('field-sizing-content')
  })
})
