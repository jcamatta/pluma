// ActivityView is pure: a collapsible header (spinner + current step while working, "Worked"/"Run
// failed" + step count once settled) over the timeline of LogRows. Stop lives with the composer now.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LogEntry, RunStatus } from '../step'
import { ActivityView } from '../Activity.view'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: { title: 'Sign-in expired', remedy: 'Sign in to Claude again.' },
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

interface Run {
  readonly status: RunStatus
  readonly log: readonly LogEntry[]
}

const working: Run = {
  status: 'working',
  log: [{ id: 't1', status: 'calling', text: 'Calling propose_edit…', toolName: 'propose_edit' }]
}

const done: Run = {
  status: 'done',
  log: [{ id: 't1', status: 'success', text: 'propose_edit' }]
}

const errored: Run = {
  status: 'error',
  log: [{ id: 'error-0', status: 'failed', text: 'Run failed: agent run failed' }]
}

function renderActivity(run: Run, overrides = {}): { onToggleExpand: ReturnType<typeof vi.fn> } {
  const onToggleExpand = vi.fn()
  render(
    <ActivityView
      status={run.status}
      log={run.log}
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

  it('when errored: shows the failure title and its remedy, not "Worked"', () => {
    renderActivity(errored)

    expect(screen.getByText('Sign-in expired')).toBeInTheDocument()
    expect(screen.getByText('Sign in to Claude again.')).toBeInTheDocument()
    expect(screen.queryByText('Worked')).not.toBeInTheDocument()
  })

  it('when errored without a remedy: shows the title alone', () => {
    renderActivity(errored, { labels: { ...labels, runFailed: { title: 'Run failed' } } })

    expect(screen.getByText('Run failed')).toBeInTheDocument()
    expect(screen.queryByText('Sign in to Claude again.')).not.toBeInTheDocument()
  })

  it('while working or when done: shows no remedy line', () => {
    renderActivity(working)
    renderActivity(done)

    expect(screen.queryByText('Sign in to Claude again.')).not.toBeInTheDocument()
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
