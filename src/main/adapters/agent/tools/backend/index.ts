import { readFileTool } from './read-file-tool'
import { listFolderTool } from './list-folder-tool'
import type { BackendTool } from './backend-tool'

const backendTools = (cwd: string | undefined): readonly BackendTool[] => [
  readFileTool,
  listFolderTool(cwd)
]

export { backendTools }
