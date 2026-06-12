// ProposalCard renders the before/after rewrite, selects on a body click, and accepts/rejects without
// re-selecting. A conflicted proposal hides Accept and shows the conflicted badge.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProposalCard } from '../ProposalCard.view'
import type { ProposalArtifact } from '../artifact'

const labels = {
  proposedRewrite: 'Proposed rewrite',
  conflicted: 'Conflicted',
  accept: 'Accept',
  reject: 'Reject'
}

function ready(): ProposalArtifact {
  return {
    kind: 'proposal',
    id: 'p_1',
    from: 4,
    originalText: 'only paper',
    replacementText: 'paper she could burn',
    status: 'ready'
  }
}

describe('ProposalCard', () => {
  it('renders the before/after rewrite and both actions when ready', () => {
    render(
      <ProposalCard
        artifact={ready()}
        active={false}
        onClick={() => undefined}
        onAccept={() => undefined}
        onReject={() => undefined}
        labels={labels}
      />
    )

    expect(screen.getByText('only paper')).toBeInTheDocument()
    expect(screen.getByText('paper she could burn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('selects on a body click and accepts without re-selecting', () => {
    const onClick = vi.fn()
    const onAccept = vi.fn()
    render(
      <ProposalCard
        artifact={ready()}
        active
        onClick={onClick}
        onAccept={onAccept}
        onReject={() => undefined}
        labels={labels}
      />
    )

    fireEvent.click(screen.getByText('only paper'))
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('hides Accept and shows the conflicted badge when conflicted', () => {
    render(
      <ProposalCard
        artifact={{ ...ready(), status: 'conflicted' }}
        active={false}
        onClick={() => undefined}
        onAccept={() => undefined}
        onReject={() => undefined}
        labels={labels}
      />
    )

    expect(screen.getByText('Conflicted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })
})
