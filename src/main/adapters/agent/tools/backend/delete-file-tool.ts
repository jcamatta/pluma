import type { Tool } from '@ag-ui/core'
import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'
import { deleteFile } from '../../../../application/file/usecase/delete-file'
import { FsFileWriterLive } from '../../../file/fs-file-writer'
import { gatedUseCaseTool } from '../gated-use-case-tool'
import type { GatedDeps } from '../gated-use-case-tool'
import type { BackendTool } from './backend-tool'

const spec: Tool = {
  name: 'delete_file',
  description:
    'Delete a markdown file at an absolute path, taken from a list_folder result. This is a mutating action that requires the user’s explicit approval: the user sees an Approve/Reject card before it takes effect.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path of the .md file to delete.'
      }
    }
  }
}

const hasPath = (args: unknown): args is { readonly path: string } =>
  typeof args === 'object' &&
  args !== null &&
  'path' in args &&
  typeof Reflect.get(args, 'path') === 'string'

const deleteFileTool = (deps: GatedDeps): BackendTool => ({
  spec,
  run: (args: unknown): Effect.Effect<AgentToolResult> => {
    if (!hasPath(args)) {
      return Effect.succeed({ ok: false, error: 'invalid_args' })
    }

    return gatedUseCaseTool({
      bridge: deps.bridge,
      runId: deps.runId,
      toolName: 'delete_file',
      args,
      effect: deleteFile(args.path).pipe(
        Effect.provide(FsFileWriterLive),
        Effect.provide(NodeContext.layer)
      ),
      toOutput: (validPath) => ({ type: 'text', text: validPath }),
      fallback: 'delete_file_failed'
    })
  }
})

export { deleteFileTool }
