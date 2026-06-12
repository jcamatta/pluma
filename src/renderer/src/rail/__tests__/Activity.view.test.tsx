// ActivityView is pure: a collapsible header (spinner + current step while working, "Worked"/"Run
// failed" + step count once settled) over the timeline of LogRows. Stop lives with the composer now.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { AgentActivity } from '../activity-log'
import { ActivityView } from '../Activity.view'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: 'Run failed',
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

const working: AgentActivity = {
  status: 'working',
  startedAt: 0,
  log: [{ id: 't1', status: 'calling', text: 'Calling propose_edit…', toolName: 'propose_edit' }],
  summary: ''
}

const done: AgentActivity = {
  status: 'done',
  startedAt: 0,
  log: [{ id: 't1', status: 'success', text: 'propose_edit' }],
  summary: 'Tightened the opening paragraph.'
}

const errored: AgentActivity = {
  status: 'error',
  startedAt: 0,
  log: [{ id: 'error-0', status: 'failed', text: 'Run failed: agent run failed' }],
  summary: ''
}

function renderActivity(
  activity: AgentActivity,
  overrides = {}
): { onToggleExpand: ReturnType<typeof vi.fn> } {
  const onToggleExpand = vi.fn()
  render(
    <ActivityView
      activity={activity}
      labels={labels}
      expanded
      onToggleExpand={onToggleExpand}
      {...overrides}
    />
  )
  return { onToggleExpand }
}

describe('ActivityView', () => {
  it('while working: shows the current step as the header label and the timeline row', () => {
    renderActivity(working)

    // The current step shows both as the collapsible header label and as its timeline row.
    expect(screen.getAllByText('Calling propose_edit…')).toHaveLength(2)
  })

  it('while working with no step yet: falls back to "Thinking…", never "Worked"', () => {
    renderActivity({ ...working, log: [] })

    expect(screen.getByText('Thinking…')).toBeInTheDocument()
    expect(screen.queryByText('Worked')).not.toBeInTheDocument()
  })

  it('when done: shows "Worked" and the step count without a leading dot', () => {
    renderActivity(done)

    expect(screen.getByText('Worked')).toBeInTheDocument()
    expect(screen.getByText('1 step')).toBeInTheDocument()
    expect(screen.queryByText('· 1 step')).not.toBeInTheDocument()
  })

  it('when errored: shows "Run failed", not "Worked"', () => {
    renderActivity(errored)

    expect(screen.getByText('Run failed')).toBeInTheDocument()
    expect(screen.queryByText('Worked')).not.toBeInTheDocument()
  })

  it('hides the timeline when collapsed', () => {
    renderActivity(done, { expanded: false })
    expect(screen.queryByText('propose_edit')).not.toBeInTheDocument()
  })

  it('toggles expansion through the header when settled', () => {
    const { onToggleExpand } = renderActivity(done)

    fireEvent.click(screen.getByRole('button', { name: /Worked/ }))
    expect(onToggleExpand).toHaveBeenCalledOnce()
  })

  it('toggles expansion through the header while still working', () => {
    const { onToggleExpand } = renderActivity(working)

    const header = screen.getByRole('button', { name: /Calling propose_edit…/ })
    expect(header).toBeEnabled()
    fireEvent.click(header)
    expect(onToggleExpand).toHaveBeenCalledOnce()
  })
})
