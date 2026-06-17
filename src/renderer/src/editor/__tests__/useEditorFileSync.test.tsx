// useEditorFileSync against an in-memory fake repository and a real headless editor: it loads the
// file's content on mount, reloads it when the OS reports an external change (disk-wins), debounces
// edits back to disk while advancing the baseline, and — because the baseline advances on our own
// writes — does not revert newer keystrokes when one of those writes echoes back through the watcher.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { useEditorFileSync } from '../useEditorFileSync'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

type SyncCase = {
  readonly repos: FakeRepository
  readonly editor: Editor
  readonly path: string
}

function renderSync({
  repos,
  editor,
  path
}: SyncCase): ReturnType<typeof renderHook<{ readonly loaded: boolean }, void>> {
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ReposHarness repos={repos}>{children}</ReposHarness>
  )
  return renderHook(() => useEditorFileSync(editor, path), { wrapper })
}

function wroteContaining(repos: FakeRepository, fragment: string): boolean {
  return repos.written().some((entry) => entry.content.includes(fragment))
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('useEditorFileSync', () => {
  it('loads the file content into the editor on mount', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# Loaded' })
    const editor = createTestEditor('')
    renderSync({ repos, editor, path: '/a.md' })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# Loaded'))

    editor.destroy()
  })

  it('flips loaded true only once the disk content is in the document', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# Loaded' })
    const editor = createTestEditor('')
    const { result } = renderSync({ repos, editor, path: '/a.md' })

    expect(result.current.loaded).toBe(false)

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(editor.getMarkdown()).toContain('# Loaded')

    editor.destroy()
  })

  it('reloads the editor when the file changes on disk (disk-wins)', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# Original' })
    const editor = createTestEditor('')
    renderSync({ repos, editor, path: '/a.md' })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# Original'))

    await act(async () => {
      repos.setFile('/a.md', '# Changed externally')
      repos.emit({ type: 'updated', path: '/a.md' })
    })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# Changed externally'))

    editor.destroy()
  })

  it('does not revert newer keystrokes when its own write echoes back', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# A' })
    const editor = createTestEditor('')
    renderSync({ repos, editor, path: '/a.md' })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# A'))

    act(() => {
      editor.commands.setContent('# A saved', { contentType: 'markdown' })
    })
    await waitFor(() => expect(wroteContaining(repos, 'saved')).toBe(true), { timeout: 2000 })

    act(() => {
      editor.commands.setContent('# A saved and typing', { contentType: 'markdown' })
    })
    await act(async () => {
      repos.emit({ type: 'updated', path: '/a.md' })
    })
    await settle()

    expect(editor.getMarkdown()).toContain('typing')

    editor.destroy()
  })

  it('debounces an edit into a write back to disk', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# A' })
    const editor = createTestEditor('')
    renderSync({ repos, editor, path: '/a.md' })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# A'))

    act(() => {
      editor.commands.setContent('# A edited', { contentType: 'markdown' })
    })

    await waitFor(() => expect(wroteContaining(repos, 'edited')).toBe(true), { timeout: 2000 })

    editor.destroy()
  })

  it('flushes the latest markdown on unmount', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# A' })
    const editor = createTestEditor('')
    const { unmount } = renderSync({ repos, editor, path: '/a.md' })

    await waitFor(() => expect(editor.getMarkdown()).toContain('# A'))

    act(() => {
      editor.commands.setContent('# A final', { contentType: 'markdown' })
    })
    unmount()

    expect(repos.written().at(-1)?.content).toContain('final')

    editor.destroy()
  })
})
