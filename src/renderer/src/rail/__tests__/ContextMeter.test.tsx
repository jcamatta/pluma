// Tests for the ContextMeter plain component: the trigger carries the worded summary as its accessible
// label and renders the ring; opening the popover reveals the window title and the per-component token
// breakdown. Rendered with plain props — no agent, no IPC.

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContextMeter } from '../ContextMeter'

const usage = {
  usedTokens: 12_400,
  windowTokens: 1_000_000,
  breakdown: { inputTokens: 1200, cacheReadTokens: 11_000, cacheCreationTokens: 200 }
}

const labels = {
  context: 'Context',
  title: 'Context window',
  input: 'Input',
  cacheRead: 'Cached',
  cacheWrite: 'Cache write'
}

describe('ContextMeter', () => {
  it('labels the trigger with the worded summary and renders the ring', () => {
    render(<ContextMeter usage={usage} labels={labels} />)

    expect(screen.getByRole('button', { name: 'Context 12.4k / 1.0M (1%)' })).toBeInTheDocument()
    expect(screen.getByTestId('context-ring')).toBeInTheDocument()
  })

  it('reveals the window title and token breakdown when opened', () => {
    render(<ContextMeter usage={usage} labels={labels} />)

    fireEvent.click(screen.getByTestId('context-meter'))

    expect(screen.getByText('Context window')).toBeInTheDocument()
    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText('1.2k')).toBeInTheDocument()
    expect(screen.getByText('11.0k')).toBeInTheDocument()
    expect(screen.getByText('Cache write')).toBeInTheDocument()
  })
})
