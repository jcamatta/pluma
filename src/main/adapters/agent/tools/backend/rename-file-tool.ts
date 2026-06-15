import type { Tool } from '@ag-ui/core'
import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'
import { renameFile } from '../../../../application/file/usecase/rename-file'
import { FsFileWriterLive } from '../../../file/fs-file-writer'
import { gatedUseCaseTool } from '../gated-use-case-tool'
import type { GatedDeps } from '../gated-use-case-tool'
import type { BackendTool } from './backend-tool'

const spec: Tool = {
  name: 'rename_file',
  description:
    'Rename or move a markdown file from one absolute path to another, both taken from a list_folder result. This is a mutating action that requires the user’s explicit approval: the user sees an Approve/Reject card before it takes effect.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['oldPath', 'newPath'],
    properties: {
      oldPath: {
        type: 'string',
        description: 'Absolute path of the existing .md file to rename.'
      },
      newPath: {
        type: 'string',
        description: 'Absolute path the .md file should be renamed to.'
      }
    }
  }
}

const hasPaths = (args: unknown): args is { readonly oldPath: string; readonly newPath: string } =>
  typeof args === 'object' &&
  args !== null &&
  'oldPath' in args &&
  'newPath' in args &&
  typeof Reflect.get(args, 'oldPath') === 'string' &&
  typeof Reflect.get(args, 'newPath') === 'string'

const renameFileTool = (deps: GatedDeps): BackendTool => ({
  spec,
  run: (args: unknown): Effect.Effect<AgentToolResult> => {
    if (!hasPaths(args)) {
      return Effect.succeed({ ok: false, error: 'invalid_args' })
    }

    return gatedUseCaseTool({
      bridge: deps.bridge,
      runId: deps.runId,
      toolName: 'rename_file',
      args,
      effect: renameFile(args.oldPath, args.newPath).pipe(
        Effect.provide(FsFileWriterLive),
        Effect.provide(NodeContext.layer)
      ),
      toOutput: (validPath) => ({ type: 'text', text: validPath }),
      fallback: 'rename_file_failed'
    })
  }
})

export { renameFileTool }
