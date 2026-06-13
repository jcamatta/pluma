// View test for the launcher's workspace skeleton: a pure visual component. The inner columns are
// decorative (aria-hidden shimmers), so the contract under test is that it renders as a single labelled
// preview image. Needs only i18n for the resolved label.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { WorkspacePreview } from '../WorkspacePreview'

describe('WorkspacePreview', () => {
  it('renders as a single labelled preview image', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <WorkspacePreview />
      </I18nextProvider>
    )
    expect(screen.getByRole('img', { name: 'Preview of the Pluma workspace' })).toBeInTheDocument()
  })
})
