// TranscriptView is pure: it renders the folded items as user bubbles and assistant replies, in order.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TranscriptView } from '../Transcript.view'
import type { TranscriptItem } from '../transcript-logic'

const items: TranscriptItem[] = [
  { id: 'u1', role: 'user', text: 'what is my name?' },
  { id: 'a1', role: 'assistant', text: 'Your name is Joel.' },
  { id: 'u2', role: 'user', text: 'another message' }
]

describe('TranscriptView', () => {
  it('renders every turn in order', () => {
    render(<TranscriptView items={items} />)

    expect(screen.getByText('what is my name?')).toBeInTheDocument()
    expect(screen.getByText('Your name is Joel.')).toBeInTheDocument()
    expect(screen.getByText('another message')).toBeInTheDocument()
  })

  it('renders nothing for an empty transcript', () => {
    const { container } = render(<TranscriptView items={[]} />)
    expect(container.querySelector('.rise-in')).toBeNull()
  })

  it('renders assistant markdown as marks, not raw asterisks', () => {
    render(
      <TranscriptView items={[{ id: 'a', role: 'assistant', text: 'tighten the **intro**' }]} />
    )

    expect(screen.getByText('intro').tagName).toBe('STRONG')
  })
})
