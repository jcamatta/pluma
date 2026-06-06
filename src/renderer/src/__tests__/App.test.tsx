// Smoke test for the root App component: it renders the translated app title.

import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { App } from '../App'

describe('App', () => {
  it('renders the app title', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    )

    expect(screen.getByText(i18n.t('appTitle'))).toBeInTheDocument()
  })
})
