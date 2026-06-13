// RunControlSelect renders a Base UI Select trigger that shows the current option's label and exposes the
// given aria-label. Pure surface: the popup interaction is not driven here (the controller's value
// narrowing is covered by useRunControls); this asserts the trigger the user sees in the composer.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunControlSelect } from '../RunControlSelect.view'

const options = [
  { value: 'claude-opus-4-8', label: 'Opus 4.8' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' }
]

const noop = (): void => undefined

describe('RunControlSelect', () => {
  it('shows the selected option label and exposes the aria-label', () => {
    render(
      <RunControlSelect
        ariaLabel="Model"
        value="claude-sonnet-4-6"
        options={options}
        onValueChange={noop}
      />
    )

    expect(screen.getByLabelText('Model')).toBeInTheDocument()
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument()
  })
})
