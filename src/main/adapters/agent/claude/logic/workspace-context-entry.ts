// Calculation: state the open workspace root to the model as a context entry, so the absolute path is
// in the transcript from turn one instead of being inferred from a tool result. With no folder open
// there is no root to assert, so nothing is produced and the system prompt covers that case in words.

import type { AgentContextEntry } from '../../../../application/agent/data/agent-context-entry'

const DESCRIPTION =
  'The absolute path of the open workspace root. Files you create belong under it unless the user says otherwise.'

const workspaceContextEntry = (cwd: string | undefined): AgentContextEntry | undefined =>
  cwd === undefined || cwd.trim() === '' ? undefined : { description: DESCRIPTION, value: cwd }

export { workspaceContextEntry }
