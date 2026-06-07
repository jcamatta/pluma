// useFrontendTool + the registry: a mounted component contributes its tool to snapshot()/byName(),
// and unmounting removes it. byName resolves the live handler so the bridge can dispatch by name.

import { describe, expect, it } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Tool } from '@ag-ui/core'
import { useToolRegistry, type ToolRegistry } from '../AgentToolsContext'
import { AgentToolsProvider } from '../AgentToolsProvider'
import { useFrontendTool } from '../useFrontendTool'

const spec: Tool = {
  name: 'echo',
  description: 'echo the args back',
  parameters: { type: 'object', properties: {} }
}

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <AgentToolsProvider>{children}</AgentToolsProvider>
}

describe('useFrontendTool', () => {
  it('registers the tool while mounted and exposes it via the registry', () => {
    const { result } = renderHook(
      () => {
        useFrontendTool({
          spec,
          handler: () => ({ ok: true, output: { type: 'text', text: 'hi' } })
        })
        return useToolRegistry()
      },
      { wrapper }
    )

    expect(result.current.snapshot().map((tool) => tool.name)).toEqual(['echo'])
    expect(result.current.byName('echo')?.spec).toEqual(spec)
  })

  it('resolves the registered handler by name', async () => {
    const { result } = renderHook(
      () => {
        useFrontendTool({
          spec,
          handler: () => ({ ok: true, output: { type: 'text', text: 'pong' } })
        })
        return useToolRegistry()
      },
      { wrapper }
    )

    const output = await result.current.byName('echo')?.handler({})
    expect(output).toEqual({ ok: true, output: { type: 'text', text: 'pong' } })
  })

  it('unregisters the tool when the owning component unmounts', () => {
    // One provider shared between the tool owner and an observer that captures the registry, so
    // mounting/unmounting the owner is reflected in the same registry instance.
    function Owner(): null {
      useFrontendTool({ spec, handler: () => ({ ok: true, output: { type: 'text', text: 'hi' } }) })
      return null
    }

    const holder: { registry: ToolRegistry | undefined } = { registry: undefined }

    function Observer(): null {
      holder.registry = useToolRegistry()
      return null
    }

    function Tree({ mounted }: { readonly mounted: boolean }): React.JSX.Element {
      return (
        <AgentToolsProvider>
          <Observer />
          {mounted ? <Owner /> : null}
        </AgentToolsProvider>
      )
    }

    const { rerender } = render(<Tree mounted={true} />)
    expect(holder.registry?.byName('echo')?.spec).toEqual(spec)

    rerender(<Tree mounted={false} />)
    expect(holder.registry?.byName('echo')).toBeUndefined()
  })
})
