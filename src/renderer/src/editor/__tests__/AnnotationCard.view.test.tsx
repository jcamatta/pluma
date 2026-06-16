// The annotation card renders the note's label (tinted to its severity) and a named severity word, plus
// the quote, description, and originating tool name; offers a Got it action while pending; shows the
// settled Read state once read (no Got-it action); and never surfaces an "Ask to revise" control
// (omitted this pass). The label is the header — it must not also repeat as a bold body line.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnnotationCard } from '../AnnotationCard.view'
import type { AnnotationCardProps } from '../AnnotationCard.view'

const labels = { title: 'Note', severity: 'Caution', gotIt: 'Got it', read: 'Read' }

function renderCard(over: Partial<AnnotationCardProps> = {}): void {
  render(
    <AnnotationCard
      label="Tension"
      severity="warning"
      quote="only paper"
      description="Soften the threat."
      status="pending"
      top={40}
      left={20}
      reduceMotion={false}
      labels={labels}
      onGotIt={() => undefined}
      {...over}
    />
  )
}

describe('AnnotationCard', () => {
  it('renders the label once, the severity word, quote, description, and tool tag', () => {
    renderCard()

    // The label is the header now, not also a bold body line.
    expect(screen.getAllByText('Tension')).toHaveLength(1)
    expect(screen.getByText('Caution')).toBeInTheDocument()
    expect(screen.getByText(/only paper/)).toBeInTheDocument()
    expect(screen.getByText('Soften the threat.')).toBeInTheDocument()
    expect(screen.getByText('create_annotation')).toBeInTheDocument()
  })

  it('tints the card to its severity', () => {
    renderCard({ severity: 'error' })
    expect(screen.getByRole('dialog')).toHaveClass('annotation-error')
  })

  it('fires Got it while pending', () => {
    const onGotIt = vi.fn()
    renderCard({ onGotIt })

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onGotIt).toHaveBeenCalledTimes(1)
  })

  it('shows Read with no Got-it action once read', () => {
    renderCard({ status: 'read' })

    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument()
  })

  it('never surfaces an Ask to revise control', () => {
    renderCard()
    expect(screen.queryByText(/ask to revise/i)).not.toBeInTheDocument()
  })
})
