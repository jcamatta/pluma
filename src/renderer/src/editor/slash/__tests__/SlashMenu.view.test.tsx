// SlashMenuView is pure props: it lists the block-type rows, marks the active one, fires onSelect/onHover,
// and shows the empty label when there are no matches.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SlashMenuView } from '../SlashMenu.view'
import type { SlashMenuItem } from '../SlashMenu.view'

const items: readonly SlashMenuItem[] = [
  { id: 'text', label: 'Text', hint: '' },
  { id: 'heading1', label: 'Heading 1', hint: '#' },
  { id: 'heading2', label: 'Heading 2', hint: '##' }
]

const renderMenu = (
  overrides: Partial<React.ComponentProps<typeof SlashMenuView>> = {}
): React.ComponentProps<typeof SlashMenuView> => {
  const props: React.ComponentProps<typeof SlashMenuView> = {
    items,
    activeIndex: 0,
    placement: { left: 10, top: 20, bottom: null, maxHeight: 320 },
    heading: 'Basic blocks',
    emptyLabel: 'No results',
    onSelect: vi.fn(),
    onHover: vi.fn(),
    ...overrides
  }
  render(<SlashMenuView {...props} />)
  return props
}

describe('SlashMenuView', () => {
  it('renders the heading and a row per item with its hint', () => {
    renderMenu()
    expect(screen.getByText('Basic blocks')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /Heading 1/ })).toHaveTextContent('#')
  })

  it('marks the active row as selected', () => {
    renderMenu({ activeIndex: 1 })
    expect(screen.getByRole('option', { selected: true })).toHaveAccessibleName(/Heading 1/)
  })

  it('fires onSelect with the row index when a row is clicked', () => {
    const { onSelect } = renderMenu()
    fireEvent.click(screen.getByRole('option', { name: /Heading 2/ }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('fires onHover with the row index on mouse enter', () => {
    const { onHover } = renderMenu()
    fireEvent.mouseEnter(screen.getByRole('option', { name: /Text/ }))
    expect(onHover).toHaveBeenCalledWith(0)
  })

  it('shows the empty label when there are no items', () => {
    renderMenu({ items: [] })
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
