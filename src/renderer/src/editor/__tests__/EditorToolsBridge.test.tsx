// EditorToolsBridge contributes the editor tools from the shell and builds the real `ensure`: an acting
// tool on a closed-but-readable path pre-reads it, opens it in the background, and resolves once the
// editor is marked ready; an unreadable path fails with no phantom tab (no openInBackground); an
// already-open path skips the disk read entirely and works without touching the active file.

import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { OpenEditorsStore } from '../open-editors-store'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { useToolRegistry } from '../../agent/AgentToolsContext'
import { RepositoriesContext, type Repositories } from '../../explorer/RepositoriesContext'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import { agentToolSpecs, proposeEditTool } from '../../agent/tools/specs'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { OpenFilesContext } from '../OpenFilesContext'
import { EditorToolsBridge } from '../EditorToolsBridge'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'

const PATH = '/test.md'

// Repos seeded from the given files, with `fileReader.read` spied so a test can assert whether the disk
// was consulted (the already-open path must skip it, the unreadable path must not open a tab).
function reposWith(files: Readonly<Record<string, string>>): {
  readonly repos: Repositories
  readonly read: ReturnType<typeof vi.fn>
} {
  const fake = createFakeFolderRepository({}, files)
  const read = vi.fn((path: string) => fake.fileReader.read(path))
  return { repos: { ...fake, fileReader: { read } }, read }
}

// Drives the store the way an EditorController would: mount the editor at PATH then mark it ready, so
// the bridge's waitUntilReady settles. Returned as a thunk so a test can run it eagerly (already-open
// case) or hand it to openInBackground (open-on-demand case).
function mountReady(store: OpenEditorsStore, editor: Editor): () => void {
  return () => {
    store.mount(PATH, editor)
    store.markReady(PATH)
  }
}

function buildWrapper(
  repos: Repositories,
  openInBackground: (path: string) => void
): ({ children }: { readonly children: ReactNode }) => React.JSX.Element {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>
        <RepositoriesContext.Provider value={repos}>
          <AgentToolsProvider>
            <ActiveEditorProvider>
              <OpenFilesContext.Provider
                value={{
                  activePath: PATH,
                  open: () => undefined,
                  openInBackground,
                  close: () => undefined
                }}
              >
                <EditorToolsBridge />
                {children}
              </OpenFilesContext.Provider>
            </ActiveEditorProvider>
          </AgentToolsProvider>
        </RepositoriesContext.Provider>
      </QueryClientProvider>
    )
  }
}

const PROPOSE = { passage: 'world', text: 'earth' }

describe('EditorToolsBridge open-on-demand', () => {
  it('opens a closed-but-readable path in the background and stages the proposal once it is ready', async () => {
    const editor = createTestEditor('hello world')
    const { repos, read } = reposWith({ [PATH]: 'hello world' })
    // openInBackground is what the real shell wires to the store; here it mounts the editor so the
    // bridge's waitUntilReady has an entry to settle on, then marks it ready to resolve the await.
    const openInBackground = vi.fn()
    try {
      const wrapper = buildWrapper(repos, openInBackground)
      const { result } = renderHook(
        () => ({ registry: useToolRegistry(), active: useActiveEditor() }),
        { wrapper }
      )
      openInBackground.mockImplementation(mountReady(result.current.active.store, editor))

      const proposed = await result.current.registry
        .byName(proposeEditTool.name)
        ?.handler({ path: PATH, ...PROPOSE })

      expect(proposed?.ok).toBe(true)
      expect(read.mock.calls).toEqual([[PATH]])
      expect(openInBackground).toHaveBeenCalledWith(PATH)
    } finally {
      editor.destroy()
    }
  })

  it('rejects an unreadable path and opens no tab', async () => {
    const { repos, read } = reposWith({})
    const openInBackground = vi.fn()
    const wrapper = buildWrapper(repos, openInBackground)
    const { result } = renderHook(() => useToolRegistry(), { wrapper })

    const rejected = await result.current
      .byName(proposeEditTool.name)
      ?.handler({ path: '/gone.md', ...PROPOSE })

    expect(rejected).toEqual({
      ok: false,
      error: '/gone.md does not exist or cannot be read'
    })
    expect(read.mock.calls).toEqual([['/gone.md']])
    expect(openInBackground).not.toHaveBeenCalled()
  })

  it('skips the disk read for an already-open ready path and leaves the active file untouched', async () => {
    const editor = createTestEditor('hello world')
    const { repos, read } = reposWith({ [PATH]: 'hello world' })
    const openInBackground = vi.fn()
    try {
      const wrapper = buildWrapper(repos, openInBackground)
      const { result } = renderHook(
        () => ({ registry: useToolRegistry(), active: useActiveEditor() }),
        { wrapper }
      )
      act(mountReady(result.current.active.store, editor))

      const proposed = await result.current.registry
        .byName(proposeEditTool.name)
        ?.handler({ path: PATH, ...PROPOSE })

      expect(proposed?.ok).toBe(true)
      expect(read).not.toHaveBeenCalled()
      expect(openInBackground).not.toHaveBeenCalled()
    } finally {
      editor.destroy()
    }
  })
})

describe('EditorToolsBridge registration', () => {
  it('registers all the editor tools', async () => {
    const { repos } = reposWith({ [PATH]: 'hello world' })
    const wrapper = buildWrapper(repos, vi.fn())
    const { result } = renderHook(() => useToolRegistry(), { wrapper })

    await waitFor(() => expect(result.current.snapshot()).toHaveLength(agentToolSpecs.length))
    expect(result.current.snapshot().map((tool) => tool.name)).toEqual(
      agentToolSpecs.map((tool) => tool.name)
    )
  })
})
