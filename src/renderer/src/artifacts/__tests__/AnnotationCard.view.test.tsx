// AnnotationCard renders the annotation's label, quote, and note, selects on a body click, and dismisses
// without also selecting (the action stops propagation).

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnnotationCard } from '../AnnotationCard.view'
import type { AnnotationArtifact } from '../artifact'

const artifact: AnnotationArtifact = {
  kind: 'annotation',
  path: '/manuscript/Act I.md',
  id: 'a_1',
  from: 10,
  label: 'Tension',
  description: 'Soften the threat.',
  severity: 'warning',
  quote: 'only paper'
}

describe('AnnotationCard', () => {
  it('renders the label, quote, and description', () => {
    render(
      <AnnotationCard
        artifact={artifact}
        active={false}
        onClick={() => undefined}
        onDismiss={() => undefined}
        labels={{ dismiss: 'Dismiss' }}
      />
    )

    expect(screen.getByText('Tension')).toBeInTheDocument()
    expect(screen.getByText(/only paper/)).toBeInTheDocument()
    expect(screen.getByText('Soften the threat.')).toBeInTheDocument()
    expect(screen.getByText('Act I')).toBeInTheDocument()
  })

  it('selects on a body click, and dismisses without re-selecting', () => {
    const onClick = vi.fn()
    const onDismiss = vi.fn()
    render(
      <AnnotationCard
        artifact={artifact}
        active
        onClick={onClick}
        onDismiss={onDismiss}
        labels={{ dismiss: 'Dismiss' }}
      />
    )

    fireEvent.click(screen.getByText('Soften the threat.'))
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
