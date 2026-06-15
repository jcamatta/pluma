import { readFileTool } from './read-file-tool'
import { listFolderTool } from './list-folder-tool'
import { createFileTool } from './create-file-tool'
import { renameFileTool } from './rename-file-tool'
import { deleteFileTool } from './delete-file-tool'
import type { BackendTool } from './backend-tool'
import type { ToolBridge } from '../tool-bridge'

interface BackendToolsDeps {
  readonly cwd: string | undefined
  readonly bridge: ToolBridge
  readonly runId: string
}

const backendTools = (deps: BackendToolsDeps): readonly BackendTool[] => {
  const gated = { bridge: deps.bridge, runId: deps.runId }
  return [
    readFileTool,
    listFolderTool(deps.cwd),
    createFileTool(gated),
    renameFileTool(gated),
    deleteFileTool(gated)
  ]
}

export { backendTools }
export type { BackendToolsDeps }
