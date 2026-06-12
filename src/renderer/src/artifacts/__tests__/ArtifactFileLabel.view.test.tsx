// ArtifactFileLabel names the file an artifact belongs to: the path's basename with `.md` stripped, the
// same name the editor top bar shows. The full path is exposed as a hover title for disambiguation.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtifactFileLabel } from '../ArtifactFileLabel.view'

describe('ArtifactFileLabel', () => {
  it('shows the basename without the .md extension', () => {
    render(<ArtifactFileLabel path="/manuscript/Act I.md" />)
    expect(screen.getByText('Act I')).toBeInTheDocument()
  })

  it('keeps the full path as the hover title', () => {
    render(<ArtifactFileLabel path="/manuscript/Act I.md" />)
    expect(screen.getByText('Act I')).toHaveAttribute('title', '/manuscript/Act I.md')
  })
})
