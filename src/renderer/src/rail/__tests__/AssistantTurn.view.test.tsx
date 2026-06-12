// AssistantTurnView is pure: it embeds the run's activity and shows the streamed reply once the run
// lands (never while it is still working).

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentActivity } from '../activity-log'
import { AssistantTurnView } from '../AssistantTurn.view'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: 'Run failed',
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

const base = {
  labels,
  expanded: true,
  onToggleExpand: () => undefined
}

const working: AgentActivity = { status: 'working', startedAt: 0, log: [], summary: 'partial…' }
const done: AgentActivity = {
  status: 'done',
  startedAt: 0,
  log: [],
  summary: 'Tightened the opening paragraph.'
}

describe('AssistantTurnView', () => {
  it('shows the reply once the run is done', () => {
    render(<AssistantTurnView {...base} activity={done} />)
    expect(screen.getByText('Tightened the opening paragraph.')).toBeInTheDocument()
  })

  it('does not show the reply while the run is still working', () => {
    render(<AssistantTurnView {...base} activity={working} />)
    expect(screen.queryByText('partial…')).not.toBeInTheDocument()
  })

  it('renders the reply markdown as marks, not raw asterisks', () => {
    const reply: AgentActivity = {
      status: 'done',
      startedAt: 0,
      log: [],
      summary: 'a **bold** edit'
    }
    render(<AssistantTurnView {...base} activity={reply} />)

    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })
})
