// Business type: the AG-UI run `state` the renderer sends to shape how the agent answers. `effort` tunes
// the reasoning effort level; `model` selects the model. Both are optional; the adapter applies defaults
// when they are omitted. This is the AG-UI `state` channel (carried from the frontend), mapped to the
// Claude SDK Options at the adapter edge.

type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type Model = 'claude-opus-4-8' | 'claude-sonnet-4-6'

interface RunAgentState {
  readonly effort?: EffortLevel
  readonly model?: Model
}

export type { EffortLevel, Model, RunAgentState }
