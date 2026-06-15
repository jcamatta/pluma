import type { Tool } from '@ag-ui/core'
import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'
import { readFile } from '../../../../application/file/usecase/read-file'
import { FsFileReaderLive } from '../../../file/fs-file-reader'
import { runUseCaseTool } from '../run-use-case-tool'
import type { BackendTool } from './backend-tool'

const spec: Tool = {
  name: 'read_file',
  description:
    'Read the full text of a markdown file in the workspace by its absolute path. Works on any file, including ones that are not open in the editor. Pass an absolute path to a .md file, taken from a list_folder result.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the .md file to read.'
      }
    }
  }
}

const hasPath = (args: unknown): args is { readonly path: string } =>
  typeof args === 'object' &&
  args !== null &&
  'path' in args &&
  typeof Reflect.get(args, 'path') === 'string'

const run = (args: unknown): Effect.Effect<AgentToolResult> => {
  if (!hasPath(args)) {
    return Effect.succeed({ ok: false, error: 'invalid_args' })
  }

  return runUseCaseTool({
    effect: readFile(args.path).pipe(
      Effect.provide(FsFileReaderLive),
      Effect.provide(NodeContext.layer)
    ),
    toOutput: (value) => ({ type: 'text', text: value }),
    fallback: 'read_file_failed'
  })
}

const readFileTool: BackendTool = { spec, run }

export { readFileTool }
