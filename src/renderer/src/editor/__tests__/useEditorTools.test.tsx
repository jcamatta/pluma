import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry, type ToolRegistry } from '../../agent/AgentToolsContext'
import {
  agentToolSpecs,
  getCurrentSelectionTool,
  insertAtTool,
  insertTool,
  listOpenFilesTool,
  proposeEditTool
} from '../../agent/tools/specs'
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

describe('useEditorTools', () => {
  it('registers all the editor tools in the registry', () => {
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

      const proposed = await registry
        .byName(proposeEditTool.name)
        ?.handler({ path: PATH, passage: 'world', text: 'earth' })

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
        .byName(proposeEditTool.name)
        ?.handler({ path: '/missing.md', passage: 'world', text: 'earth' })

      expect(result).toEqual({ ok: false, error: 'no_open_editor:/missing.md' })
    } finally {
      editor.destroy()
    }
  })

  it('reports a recoverable error on the selection read while no editor is mounted', async () => {
    const registry = renderRegistry(depsFor(null))

    const result = await registry.byName(getCurrentSelectionTool.name)?.handler({})

    expect(result).toEqual({ ok: false, error: 'No document is open in the editor.' })
  })
})

describe('useEditorTools insert dispatch', () => {
  it('dispatches insert_at against the live editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const inserted = await registry
        .byName(insertAtTool.name)
        ?.handler({ path: PATH, text: 'tail', position: 'end' })

      expect(inserted?.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })

  it('dispatches insert against the live editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const registry = renderRegistry(depsFor(editor))

      const inserted = await registry
        .byName(insertTool.name)
        ?.handler({ path: PATH, text: 'more', mode: 'after', anchor: 'world' })

      expect(inserted?.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })
})
