// Whether a backend tool mutates the workspace (a gated command) or merely reads it (a query). The SDK's
// readOnlyHint is the inverse of this. The shared GATED_TOOL_NAMES constant is the single source of truth
// the renderer and IPC agree on, but the adapters layer may not import src/shared (lint-enforced layer
// boundary), so this adapter-local predicate mirrors that set for the one thing main needs it for here.

import type { BackendTool } from './backend-tool'

const MUTATING_BACKEND_TOOL_NAMES = ['create_file', 'rename_file', 'delete_file']

const isMutatingBackendTool = (tool: BackendTool): boolean =>
  MUTATING_BACKEND_TOOL_NAMES.includes(tool.spec.name)

export { isMutatingBackendTool }
