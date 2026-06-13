// Scrollable renders its children inside the Base UI scroll area. The orientation-driven scrollbar
// classes are covered by scrollbar-axis.test.ts (the scrollbar itself only mounts under real layout,
// which jsdom does not provide).

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scrollable } from '../Scrollable'

describe('Scrollable', () => {
  it('renders its children', () => {
    render(<Scrollable>content</Scrollable>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
