// EditorSurface stacks the suggestions bar slot above the manuscript body slot in a single column. A pure
// layout view: it renders both slots in order with no logic of its own.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorSurface } from '../EditorSurface.view'

describe('EditorSurface', () => {
  it('renders the bar above the body', () => {
    render(<EditorSurface bar={<div>the bar</div>} body={<div>the body</div>} />)

    const bar = screen.getByText('the bar')
    const body = screen.getByText('the body')
    expect(bar).toBeInTheDocument()
    expect(body).toBeInTheDocument()
    expect(bar.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
