// The suggestions sub-topbar states the review count while items are pending and an "All reviewed" state at
// zero; its Hide all / Show all toggle label flips with the `visible` prop; the toggle and List buttons fire
// their callbacks. Labels arrive pre-translated as props, so the view is asserted without an i18n provider.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SuggestionsBar } from '../SuggestionsBar.view'

const labels = {
  suggestions: 'Suggestions',
  toReview: '3 to review',
  allReviewed: 'All reviewed',
  hideAll: 'Hide all',
  showAll: 'Show all',
  list: 'List'
}

describe('SuggestionsBar', () => {
  it('shows the review count while items are pending', () => {
    render(
      <SuggestionsBar
        count={3}
        visible
        reduceMotion={false}
        labels={labels}
        onToggleVisible={() => undefined}
        onOpenList={() => undefined}
      />
    )

    expect(screen.getByText('Suggestions')).toBeInTheDocument()
    expect(screen.getByText(/3 to review/)).toBeInTheDocument()
    expect(screen.queryByText('All reviewed')).not.toBeInTheDocument()
  })

  it('shows the all-reviewed state at zero', () => {
    render(
      <SuggestionsBar
        count={0}
        visible
        reduceMotion={false}
        labels={labels}
        onToggleVisible={() => undefined}
        onOpenList={() => undefined}
      />
    )

    expect(screen.getByText('All reviewed')).toBeInTheDocument()
    expect(screen.queryByText(/to review/)).not.toBeInTheDocument()
  })

  it('shows Hide all while visible and Show all while hidden', () => {
    const { rerender } = render(
      <SuggestionsBar
        count={2}
        visible
        reduceMotion={false}
        labels={labels}
        onToggleVisible={() => undefined}
        onOpenList={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Hide all' })).toBeInTheDocument()

    rerender(
      <SuggestionsBar
        count={2}
        visible={false}
        reduceMotion={false}
        labels={labels}
        onToggleVisible={() => undefined}
        onOpenList={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide all' })).not.toBeInTheDocument()
  })

  it('fires the toggle and list callbacks', () => {
    const onToggleVisible = vi.fn()
    const onOpenList = vi.fn()
    render(
      <SuggestionsBar
        count={2}
        visible
        reduceMotion={false}
        labels={labels}
        onToggleVisible={onToggleVisible}
        onOpenList={onOpenList}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }))
    fireEvent.click(screen.getByRole('button', { name: 'List' }))

    expect(onToggleVisible).toHaveBeenCalledTimes(1)
    expect(onOpenList).toHaveBeenCalledTimes(1)
  })
})
