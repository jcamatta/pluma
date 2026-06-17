// The single fact the backend (which gates these tools behind an approval round-trip) and the renderer
// (which shows the Approve/Reject card instead of dispatching to a frontend-tool handler) must agree on:
// the set of tool names whose calls are mutating commands requiring explicit human approval before they run.
// Each name is also exported on its own so the renderer's approval card can branch per command without
// re-typing the literal — the names live here once and nowhere else on the renderer side.

const CREATE_FILE_TOOL = 'create_file'
const RENAME_FILE_TOOL = 'rename_file'
const DELETE_FILE_TOOL = 'delete_file'

const GATED_TOOL_NAMES = [CREATE_FILE_TOOL, RENAME_FILE_TOOL, DELETE_FILE_TOOL] as const

type GatedToolName = (typeof GATED_TOOL_NAMES)[number]

const isGatedToolName = (name: string): name is GatedToolName =>
  GATED_TOOL_NAMES.some((n) => n === name)

export { CREATE_FILE_TOOL, RENAME_FILE_TOOL, DELETE_FILE_TOOL, GATED_TOOL_NAMES, isGatedToolName }
export type { GatedToolName }
