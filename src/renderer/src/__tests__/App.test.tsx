// Smoke test for the root App component: it mounts the editor shell.

import { render, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { i18n } from '../i18n'
import { App } from '../App'

describe('App', () => {
  it('mounts the editor', async () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    )

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })
})
