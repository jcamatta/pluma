// EditorController mounts the manuscript editor, renders the view once the editor is ready, loads its
// file's markdown by path (through the file reader port), and autosaves edits back to the open file.
// The repos harness supplies an in-memory fake for both the reader content and the writer the autosave
// drives.

import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { EditorController } from '../Editor.controller'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

function renderController(
  path: string | null,
  repos: FakeRepository = createFakeFolderRepository({})
): ReturnType<typeof render> {
  return render(
    <ReposHarness repos={repos}>
      <AgentToolsProvider>
        <ActiveEditorProvider>
          <EditorController path={path} isActive />
        </ActiveEditorProvider>
      </AgentToolsProvider>
    </ReposHarness>
  )
}

describe('EditorController', () => {
  it('renders the editor surface once the editor instance is ready', async () => {
    const { container } = renderController(null)

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })

  it('loads its file content into the editor surface', async () => {
    const repos = createFakeFolderRepository({}, { '/chapter.md': '# Chapter One' })
    const { container } = renderController('/chapter.md', repos)

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror h1')?.textContent).toBe('Chapter One')
    })
  })
})
