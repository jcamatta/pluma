// EditorController mounts the manuscript editor, renders the view once the editor is ready, loads the
// markdown content prop into the surface, and autosaves edits back to the open file. The repos harness
// supplies an in-memory fake for the file writer the autosave drives.

import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { EditorController } from '../Editor.controller'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

function renderController(
  props: { readonly path: string | null; readonly content: string | null },
  repos: FakeRepository = createFakeFolderRepository({})
): ReturnType<typeof render> {
  return render(
    <ReposHarness repos={repos}>
      <AgentToolsProvider>
        <ActiveEditorProvider>
          <EditorController
            path={props.path}
            content={props.content}
            onOpenSettings={() => undefined}
          />
        </ActiveEditorProvider>
      </AgentToolsProvider>
    </ReposHarness>
  )
}

describe('EditorController', () => {
  it('renders the editor surface once the editor instance is ready', async () => {
    const { container } = renderController({ path: null, content: null })

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })

  it('loads the markdown content into the editor surface', async () => {
    const { container } = renderController({ path: null, content: '# Chapter One' })

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror h1')?.textContent).toBe('Chapter One')
    })
  })
})
