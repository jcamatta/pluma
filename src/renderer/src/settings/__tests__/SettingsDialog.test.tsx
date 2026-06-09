// SettingsDialog renders the appearance field when open, drives setTheme from the segmented control, and
// closes via the close button. The Base UI Dialog needs the i18n provider (it calls useTranslation) and a
// real open state; we mount it open and assert against the portalled content.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { SettingsDialog } from '../SettingsDialog'
import type { UseSettings } from '../useSettings'

const renderDialog = (
  theme: UseSettings['theme'] = 'system'
): { setTheme: ReturnType<typeof vi.fn>; onOpenChange: ReturnType<typeof vi.fn> } => {
  const setTheme = vi.fn()
  const onOpenChange = vi.fn()
  const settings: UseSettings = { theme, setTheme }
  render(
    <I18nextProvider i18n={i18n}>
      <SettingsDialog open onOpenChange={onOpenChange} settings={settings} />
    </I18nextProvider>
  )
  return { onOpenChange, setTheme }
}

describe('SettingsDialog', () => {
  it('renders the appearance field when open', () => {
    renderDialog()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument()
  })

  it('calls setTheme when a theme option is selected', () => {
    const { setTheme } = renderDialog('system')
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('requests close when the close button is clicked', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByLabelText('Close settings'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
