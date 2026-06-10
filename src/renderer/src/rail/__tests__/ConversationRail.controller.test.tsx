// ConversationRailController owns the composer value and resolves labels. It surfaces the submitted
// text through onSend and clears the composer; running a turn is wired later (F4). i18n is initialized
// so t() returns the real en strings.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { ConversationRailController } from '../ConversationRail.controller'

function renderRail(onSend = vi.fn()): { onSend: ReturnType<typeof vi.fn> } {
  render(
    <I18nextProvider i18n={i18n}>
      <ConversationRailController onClose={() => undefined} onSend={onSend} />
    </I18nextProvider>
  )
  return { onSend }
}

describe('ConversationRailController', () => {
  it('sends the trimmed composer text and clears it', () => {
    const { onSend } = renderRail()
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: '  hello  ' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(onSend).toHaveBeenCalledWith('hello')
    expect(textarea).toHaveValue('')
  })

  it('does not send when the composer is empty or whitespace', () => {
    const { onSend } = renderRail()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })
})
