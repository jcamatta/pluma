import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorEmptyStateView } from '../EditorEmptyState.view'

describe('EditorEmptyStateView', () => {
  it('renders the heading and hint', () => {
    render(
      <EditorEmptyStateView
        heading="No file open"
        hint="Create a file to start writing."
        settingsLabel="Settings"
        onOpenSettings={() => undefined}
      />
    )

    expect(screen.getByText('No file open')).toBeInTheDocument()
    expect(screen.getByText('Create a file to start writing.')).toBeInTheDocument()
  })

  it('keeps the settings affordance and invokes it on click', async () => {
    const onOpenSettings = vi.fn()
    render(
      <EditorEmptyStateView
        heading="No file open"
        hint="Create a file to start writing."
        settingsLabel="Settings"
        onOpenSettings={onOpenSettings}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
