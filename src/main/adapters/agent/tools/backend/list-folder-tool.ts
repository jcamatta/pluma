import type { Tool } from '@ag-ui/core'
import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import * as nodePath from 'node:path'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'
import type { FolderEntry } from '../../../../application/folder/data/entry'
import { listFolder } from '../../../../application/folder/usecase/list-folder'
import { FsFolderReaderLive } from '../../../folder/fs-folder-reader'
import { runUseCaseTool } from '../run-use-case-tool'
import type { BackendTool } from './backend-tool'

const spec: Tool = {
  name: 'list_folder',
  description:
    'List the immediate children (one level deep) of a folder by absolute path. If path is omitted, lists the workspace root. Returns the absolute path that was listed, plus each entry name, type, and absolute path. To go deeper, call again with a subfolder absolute path.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the folder to list. Omit to list the workspace root.'
      }
    }
  }
}

type ResolvedTarget =
  | { readonly kind: 'target'; readonly path: string }
  | { readonly kind: 'invalid_args' }
  | { readonly kind: 'no_workspace' }

const hasPathKey = (args: unknown): args is { readonly path: unknown } =>
  typeof args === 'object' && args !== null && 'path' in args

const resolveTarget = (args: unknown, cwd: string | undefined): ResolvedTarget => {
  if (hasPathKey(args)) {
    const value = Reflect.get(args, 'path')
    if (typeof value !== 'string') {
      return { kind: 'invalid_args' }
    }
    return { kind: 'target', path: value }
  }
  if (cwd === undefined) {
    return { kind: 'no_workspace' }
  }
  return { kind: 'target', path: cwd }
}

const toEntries = (
  entries: ReadonlyArray<FolderEntry>,
  target: string
): ReadonlyArray<{ readonly name: string; readonly type: string; readonly path: string }> =>
  entries.map((entry) => ({
    name: entry.name,
    type: entry.type,
    path: nodePath.join(target, entry.name)
  }))

const listFolderTool = (cwd: string | undefined): BackendTool => ({
  spec,
  run: (args: unknown): Effect.Effect<AgentToolResult> => {
    const resolved = resolveTarget(args, cwd)
    if (resolved.kind !== 'target') {
      return Effect.succeed({ ok: false, error: resolved.kind })
    }

    return runUseCaseTool({
      effect: listFolder(resolved.path).pipe(
        Effect.provide(FsFolderReaderLive),
        Effect.provide(NodeContext.layer)
      ),
      // Stating the listed path lets the agent re-derive the workspace root at any point, including
      // when the root is empty and no entry carries it.
      toOutput: (entries) => ({
        type: 'json',
        value: { path: resolved.path, entries: toEntries(entries, resolved.path) }
      }),
      fallback: 'list_folder_failed'
    })
  }
})

export { listFolderTool }
