// The single fact the backend (which gates these tools behind an approval round-trip) and the renderer
// (which shows the Approve/Reject card instead of dispatching to a frontend-tool handler) must agree on:
// the set of tool names whose calls are mutating commands requiring explicit human approval before they run.

const GATED_TOOL_NAMES = ['create_file', 'rename_file', 'delete_file'] as const

type GatedToolName = (typeof GATED_TOOL_NAMES)[number]

const isGatedToolName = (name: string): name is GatedToolName =>
  GATED_TOOL_NAMES.some((n) => n === name)

export { GATED_TOOL_NAMES, isGatedToolName }
export type { GatedToolName }
