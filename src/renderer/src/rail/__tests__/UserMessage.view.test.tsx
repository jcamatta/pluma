// UserMessage is pure: it renders the given text in the right-aligned bubble.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserMessage } from '../UserMessage.view'

describe('UserMessage', () => {
  it('renders the message text', () => {
    render(<UserMessage text="revise the intro" />)
    expect(screen.getByText('revise the intro')).toBeInTheDocument()
  })
})
