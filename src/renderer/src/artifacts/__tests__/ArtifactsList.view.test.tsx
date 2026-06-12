// ArtifactsList renders the empty state when there are no artifacts, and otherwise one card per artifact
// by kind, wiring each card's interactions to the id-keyed callbacks.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ArtifactsList } from '../ArtifactsList.view'
import type { Artifact } from '../artifact'

const labels = {
  empty: 'No artifacts yet.',
  dismiss: 'Dismiss',
  proposedRewrite: 'Proposed rewrite',
  conflicted: 'Conflicted',
  accept: 'Accept',
  reject: 'Reject'
}

const artifacts: readonly Artifact[] = [
  {
    kind: 'proposal',
    id: 'p_1',
    from: 2,
    originalText: 'old',
    replacementText: 'new',
    status: 'ready'
  },
  {
    kind: 'annotation',
    id: 'a_1',
    from: 9,
    label: 'Tension',
    description: 'Soften it.',
    severity: 'warning',
    quote: 'old'
  }
]

function noop(): void {
  return undefined
}

describe('ArtifactsList', () => {
  it('shows the empty state when there are no artifacts', () => {
    render(
      <ArtifactsList
        artifacts={[]}
        activeIds={new Set()}
        onSelect={noop}
        onAccept={noop}
        onReject={noop}
        onDismiss={noop}
        labels={labels}
      />
    )

    expect(screen.getByText('No artifacts yet.')).toBeInTheDocument()
  })

  it('renders a card per artifact and selects by id', () => {
    const onSelect = vi.fn()
    render(
      <ArtifactsList
        artifacts={artifacts}
        activeIds={new Set()}
        onSelect={onSelect}
        onAccept={noop}
        onReject={noop}
        onDismiss={noop}
        labels={labels}
      />
    )

    expect(screen.getByText('Soften it.')).toBeInTheDocument()
    expect(screen.getByText('new')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Soften it.'))
    expect(onSelect).toHaveBeenCalledWith('a_1')
  })
})
