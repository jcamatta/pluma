// The annotation card renders the note's label, quote, description, and originating tool name; offers a
// Got it action while pending; shows the settled Read state once read (no Got-it action); and never
// surfaces an "Ask to revise" control (omitted this pass).

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnnotationCard } from '../AnnotationCard.view'

const labels = { title: 'Note', gotIt: 'Got it', read: 'Read' }

describe('AnnotationCard', () => {
  it('renders the label, quote, description, and tool tag', () => {
    render(
      <AnnotationCard
        label="Tension"
        quote="only paper"
        description="Soften the threat."
        status="pending"
        top={40}
        left={20}
        reduceMotion={false}
        labels={labels}
        onGotIt={() => undefined}
      />
    )

    expect(screen.getByText('Tension')).toBeInTheDocument()
    expect(screen.getByText(/only paper/)).toBeInTheDocument()
    expect(screen.getByText('Soften the threat.')).toBeInTheDocument()
    expect(screen.getByText('create_annotation')).toBeInTheDocument()
  })

  it('fires Got it while pending', () => {
    const onGotIt = vi.fn()
    render(
      <AnnotationCard
        label="Tension"
        quote="only paper"
        description="Soften the threat."
        status="pending"
        top={40}
        left={20}
        reduceMotion={false}
        labels={labels}
        onGotIt={onGotIt}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onGotIt).toHaveBeenCalledTimes(1)
  })

  it('shows Read with no Got-it action once read', () => {
    render(
      <AnnotationCard
        label="Tension"
        quote="only paper"
        description="Soften the threat."
        status="read"
        top={40}
        left={20}
        reduceMotion={false}
        labels={labels}
        onGotIt={() => undefined}
      />
    )

    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument()
  })

  it('never surfaces an Ask to revise control', () => {
    render(
      <AnnotationCard
        label="Tension"
        quote="only paper"
        description="Soften the threat."
        status="pending"
        top={40}
        left={20}
        reduceMotion={false}
        labels={labels}
        onGotIt={() => undefined}
      />
    )

    expect(screen.queryByText(/ask to revise/i)).not.toBeInTheDocument()
  })
})
