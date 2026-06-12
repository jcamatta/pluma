// EditorToolsBridge contributes the editor tools from the shell, bound to the active editor: with no
// active editor the tools are still registered but report no document; once an editor is registered
// into ActiveEditorContext the handlers dispatch against it.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry } from '../../agent/AgentToolsContext'
import { agentToolSpecs, getRangesTool } from '../../agent/tools/specs'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { EditorToolsBridge } from '../EditorToolsBridge'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <AgentToolsProvider>
      <ActiveEditorProvider>
        <EditorToolsBridge />
        {children}
      </ActiveEditorProvider>
    </AgentToolsProvider>
  )
}

describe('EditorToolsBridge', () => {
  it('registers the editor tools and binds their handlers to the active editor', async () => {
    const editor = createTestEditor('hello world')
    try {
      const { result } = renderHook(
        () => ({ registry: useToolRegistry(), active: useActiveEditor() }),
        { wrapper }
      )

      expect(result.current.registry.snapshot().map((tool) => tool.name)).toEqual(
        agentToolSpecs.map((tool) => tool.name)
      )

      const before = await result.current.registry.byName(getRangesTool.name)?.handler({
        text: 'world'
      })
      expect(before).toEqual({ ok: false, error: 'No document is open in the editor.' })

      act(() => result.current.active.register(editor))

      const after = await result.current.registry.byName(getRangesTool.name)?.handler({
        text: 'world'
      })
      expect(after?.ok).toBe(true)
    } finally {
      editor.destroy()
    }
  })
})
