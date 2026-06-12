// EditorToolsBridge contributes the editor tools from the shell, bound through the open-editor registry
// to the editor open at the active path: with nothing registered at that path the tools are still
// registered but report no document; once an editor is registered there the handlers dispatch against it.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry } from '../../agent/AgentToolsContext'
import { agentToolSpecs, getRangesTool } from '../../agent/tools/specs'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { OpenFilesContext } from '../OpenFilesContext'
import { EditorToolsBridge } from '../EditorToolsBridge'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'

const PATH = '/test.md'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <AgentToolsProvider>
      <ActiveEditorProvider>
        <OpenFilesContext.Provider value={{ activePath: PATH, open: () => undefined }}>
          <EditorToolsBridge />
          {children}
        </OpenFilesContext.Provider>
      </ActiveEditorProvider>
    </AgentToolsProvider>
  )
}

describe('EditorToolsBridge', () => {
  it('registers the editor tools and binds their handlers to the editor at the active path', async () => {
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

      act(() => result.current.active.registerEditor(PATH, editor))

      const after = await result.current.registry.byName(getRangesTool.name)?.handler({
        text: 'world'
      })
      expect(after?.ok).toBe(true)
    } finally {
      editor.destroy()
    }
  })
})
