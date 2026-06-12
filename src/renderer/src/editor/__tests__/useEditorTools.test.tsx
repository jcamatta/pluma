import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry, type ToolRegistry } from '../../agent/AgentToolsContext'
import { agentToolSpecs, getRangesTool, proposeEditTool } from '../../agent/tools/specs'
import type { AgentToolResult } from '../../agent/tools/types'
import { getProposals } from '../extensions/proposals'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { useEditorTools } from '../useEditorTools'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <AgentToolsProvider>{children}</AgentToolsProvider>
}

function renderRegistry(editor: Parameters<typeof useEditorTools>[0]): ToolRegistry {
  const { result } = renderHook(
    () => {
      useEditorTools(editor)
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
      const registry = renderRegistry(editor)
      const names = registry.snapshot().map((tool) => tool.name)
      expect(names).toEqual(agentToolSpecs.map((tool) => tool.name))
    } finally {
      editor.destroy()
    }
  })

  it('dispatches a registered handler against the live editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(editor)

      const resolved = await registry.byName(getRangesTool.name)?.handler({ text: 'world' })
      const rangeId = rangeIdOf(resolved)

      const proposed = await registry
        .byName(proposeEditTool.name)
        ?.handler({ rangeId, replacementText: 'earth' })

      expect(proposed?.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })

  it('reports a recoverable error while no editor is mounted', async () => {
    const registry = renderRegistry(null)

    const result = await registry.byName(getRangesTool.name)?.handler({ text: 'anything' })

    expect(result).toEqual({ ok: false, error: 'No document is open in the editor.' })
  })
})
