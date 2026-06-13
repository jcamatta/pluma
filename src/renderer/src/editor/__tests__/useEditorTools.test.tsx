import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry, type ToolRegistry } from '../../agent/AgentToolsContext'
import {
  agentToolSpecs,
  getContentTool,
  getCurrentSelectionTool,
  getRangesTool,
  listOpenFilesTool,
  proposeEditTool
} from '../../agent/tools/specs'
import type { AgentToolResult } from '../../agent/tools/types'
import { getProposals } from '../extensions/proposals'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { useEditorTools } from '../useEditorTools'

const PATH = '/test.md'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <AgentToolsProvider>{children}</AgentToolsProvider>
}

// Deps that resolve the active file to `editor`; a null editor models "no document open".
function depsFor(editor: Editor | null): Parameters<typeof useEditorTools>[0] {
  return {
    resolve: (path: string) => (editor !== null && path === PATH ? editor : null),
    activePath: editor === null ? null : PATH,
    openPaths: editor === null ? [] : [PATH]
  }
}

function renderRegistry(deps: Parameters<typeof useEditorTools>[0]): ToolRegistry {
  const { result } = renderHook(
    () => {
      useEditorTools(deps)
      return useToolRegistry()
    },
    { wrapper }
  )
  return result.current
}

function rangeIdOf(result: AgentToolResult | undefined): string {
  if (!result?.ok || result.output.type !== 'json') {
    return expect.fail('expected a json range result')
  }
  const value: unknown = result.output.value
  if (typeof value !== 'object' || value === null || !('rangeId' in value)) {
    return expect.fail('expected a rangeId in the range result')
  }
  const { rangeId } = value
  if (typeof rangeId !== 'string') return expect.fail('expected rangeId to be a string')
  return rangeId
}

describe('useEditorTools', () => {
  it('registers all five editor tools in the registry', () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))
      const names = registry.snapshot().map((tool) => tool.name)
      expect(names).toEqual(agentToolSpecs.map((tool) => tool.name))
    } finally {
      editor.destroy()
    }
  })

  it('dispatches a registered handler against the live editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const resolved = await registry
        .byName(getRangesTool.name)
        ?.handler({ path: PATH, text: 'world' })
      const rangeId = rangeIdOf(resolved)

      const proposed = await registry
        .byName(proposeEditTool.name)
        ?.handler({ path: PATH, rangeId, replacementText: 'earth' })

      expect(proposed?.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })

  it('lists the open files with the active one flagged', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const result = await registry.byName(listOpenFilesTool.name)?.handler({})

      expect(result).toEqual({
        ok: true,
        output: { type: 'json', value: { files: [{ path: PATH, name: 'test', active: true }] } }
      })
    } finally {
      editor.destroy()
    }
  })

  it('errors when the acting path is not an open editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const result = await registry
        .byName(getRangesTool.name)
        ?.handler({ path: '/missing.md', text: 'world' })

      expect(result).toEqual({ ok: false, error: 'no_open_editor:/missing.md' })
    } finally {
      editor.destroy()
    }
  })

  it('reads an open file at a given path, tagged with that path', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const result = await registry.byName(getContentTool.name)?.handler({ path: PATH })

      if (!result?.ok || result.output.type !== 'json') return expect.fail('expected json output')
      expect(result.output.value).toMatchObject({ path: PATH })
    } finally {
      editor.destroy()
    }
  })

  it('errors when the read path is not an open editor', async () => {
    const registry = renderRegistry(depsFor(null))

    const result = await registry.byName(getContentTool.name)?.handler({ path: '/missing.md' })

    expect(result).toEqual({ ok: false, error: 'no_open_editor:/missing.md' })
  })

  it('reports a recoverable error on the selection read while no editor is mounted', async () => {
    const registry = renderRegistry(depsFor(null))

    const result = await registry.byName(getCurrentSelectionTool.name)?.handler({})

    expect(result).toEqual({ ok: false, error: 'No document is open in the editor.' })
  })
})
