// AssistantRowView is pure: spark + an optional collapsible step timeline + the reply text. Verifies the
// reply and both step rows render when expanded, the header toggles, and a plain-text row shows no
// timeline header.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { AssistantRow } from '../conversation-rows'
import { AssistantRowView } from '../AssistantRow.view'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: 'Run failed',
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

const withSteps: AssistantRow = {
  kind: 'assistant',
  id: 'a1',
  text: 'All done.',
  steps: [
    { id: 'c1', status: 'success', text: 'Used read', toolName: 'read' },
    { id: 'c2', status: 'success', text: 'Used write', toolName: 'write' }
  ]
}

const plain: AssistantRow = { kind: 'assistant', id: 'a2', text: 'Just a reply.', steps: [] }

function renderRow(
  row: AssistantRow,
  overrides = {}
): { onToggleExpand: ReturnType<typeof vi.fn> } {
  const onToggleExpand = vi.fn()
  render(
    <AssistantRowView
      row={row}
      status="done"
      labels={labels}
      expanded
      onToggleExpand={onToggleExpand}
      {...overrides}
    />
  )
  return { onToggleExpand }
}

describe('AssistantRowView', () => {
  it('renders the reply and, expanded, both step rows under a "Worked" header', () => {
    renderRow(withSteps)

    expect(screen.getByTestId('assistant-reply')).toHaveTextContent('All done.')
    expect(screen.getByText('Used read')).toBeInTheDocument()
    expect(screen.getByText('Used write')).toBeInTheDocument()
    expect(screen.getByText('Worked')).toBeInTheDocument()
    expect(screen.getByText('2 steps')).toBeInTheDocument()
  })

  it('toggles the timeline through the header', () => {
    const { onToggleExpand } = renderRow(withSteps)

    fireEvent.click(screen.getByRole('button', { name: /Worked/ }))
    expect(onToggleExpand).toHaveBeenCalledOnce()
  })

  it('shows no timeline header for a plain text reply with no steps', () => {
    renderRow(plain)

    expect(screen.getByTestId('assistant-reply')).toHaveTextContent('Just a reply.')
    expect(screen.queryByText('Worked')).not.toBeInTheDocument()
  })
})
