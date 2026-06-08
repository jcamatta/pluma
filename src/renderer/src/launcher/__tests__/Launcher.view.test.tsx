// View test for the launcher screen: render with plain props (no providers beyond i18n) and assert the
// call-to-action renders and the Open Folder button invokes onPick. Pure-props view, so no QueryClient
// or repositories are needed.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { Launcher } from '../Launcher.view'
import type { LauncherLabels } from '../Launcher.view'

const labels: LauncherLabels = {
  wordmark: 'Pluma',
  heading: 'Open a folder.\nStart writing.',
  description: 'Point Pluma at any folder…',
  openFolder: 'Open Folder…'
}

const renderView = (onPick: () => void): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <Launcher labels={labels} onPick={onPick} />
    </I18nextProvider>
  )
}

describe('Launcher view', () => {
  it('renders the call to action and the workspace preview', () => {
    renderView(() => {})
    expect(screen.getByText('Open Folder…')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Preview of the Pluma workspace' })).toBeInTheDocument()
  })

  it('invokes onPick when the Open Folder button is clicked', () => {
    const onPick = vi.fn()
    renderView(onPick)
    fireEvent.click(screen.getByText('Open Folder…'))
    expect(onPick).toHaveBeenCalledOnce()
  })
})
