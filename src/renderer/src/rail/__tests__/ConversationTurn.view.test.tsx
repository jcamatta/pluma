// ConversationTurnView is composition only: the user's prompt bubble over the assistant side (whose
// activity + reply behavior is covered in Activity/AssistantTurn tests). Pure props.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AgentActivity } from '../activity-log'
import { ConversationTurnView } from '../ConversationTurn.view'

const labels = {
  thinking: 'Thinking…',
  worked: 'Worked',
  runFailed: 'Run failed',
  step: (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`
}

const done: AgentActivity = {
  status: 'done',
  startedAt: 0,
  log: [],
  summary: 'Tightened the opening paragraph.'
}

describe('ConversationTurnView', () => {
  it('renders the user prompt over the assistant reply', () => {
    render(
      <ConversationTurnView
        prompt="revise the intro"
        activity={done}
        labels={labels}
        expanded
        onToggleExpand={() => undefined}
      />
    )

    expect(screen.getByText('revise the intro')).toBeInTheDocument()
    expect(screen.getByText('Tightened the opening paragraph.')).toBeInTheDocument()
  })
})
