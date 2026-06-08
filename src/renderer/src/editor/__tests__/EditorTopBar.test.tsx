// EditorTopBar is a pure-props component: it shows the open file's name and fires onOpenSettings from the
// settings button.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EditorTopBar } from '../EditorTopBar'

describe('EditorTopBar', () => {
  it('renders the file name', () => {
    render(
      <EditorTopBar fileName="Act I" settingsLabel="Settings" onOpenSettings={() => undefined} />
    )
    expect(screen.getByText('Act I')).toBeInTheDocument()
  })

  it('fires onOpenSettings when the settings button is clicked', () => {
    const onOpenSettings = vi.fn()
    render(
      <EditorTopBar fileName="Act I" settingsLabel="Settings" onOpenSettings={onOpenSettings} />
    )
    fireEvent.click(screen.getByLabelText('Settings'))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
