// useAutoSave against an in-memory fake repository and a real headless editor: it debounces editor
// updates into a single write of the current markdown, writes nothing while no file is open, and flushes
// the latest markdown on unmount so an edit inside the debounce window is never lost. Fake timers drive
// the debounce; the fake repository's written() records every write.

import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useAutoSave } from '../useAutoSave'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

type AutoSaveCase = {
  readonly repos: FakeRepository
  readonly editor: Editor | null
  readonly path: string | null
}

function renderUseAutoSave({
  repos,
  editor,
  path
}: AutoSaveCase): ReturnType<typeof renderHook<void, void>> {
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ReposHarness repos={repos}>{children}</ReposHarness>
  )
  return renderHook(() => useAutoSave(editor, path), { wrapper })
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces an edit into a single write after the delay', () => {
    const repos = createFakeFolderRepository({})
    const editor = createTestEditor('# Chapter One')
    renderUseAutoSave({ repos, editor, path: '/root/a.md' })

    act(() => {
      editor.commands.insertContent(' more')
      editor.commands.insertContent(' text')
    })
    expect(repos.written()).toEqual([])

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(repos.written()).toHaveLength(1)
    expect(repos.written()[0]?.path).toBe('/root/a.md')

    editor.destroy()
  })

  it('does not write when no file is open', () => {
    const repos = createFakeFolderRepository({})
    const editor = createTestEditor('# Chapter One')
    renderUseAutoSave({ repos, editor, path: null })

    act(() => {
      editor.commands.insertContent(' more')
      vi.advanceTimersByTime(1000)
    })

    expect(repos.written()).toEqual([])

    editor.destroy()
  })

  it('flushes the latest markdown on unmount', () => {
    const repos = createFakeFolderRepository({})
    const editor = createTestEditor('# Chapter One')
    const { unmount } = renderUseAutoSave({ repos, editor, path: '/root/a.md' })

    act(() => {
      editor.commands.insertContent(' last edit')
    })
    unmount()

    const writes = repos.written()
    expect(writes.length).toBeGreaterThanOrEqual(1)
    expect(writes.at(-1)?.path).toBe('/root/a.md')
    expect(writes.at(-1)?.content).toContain('last edit')

    editor.destroy()
  })
})
