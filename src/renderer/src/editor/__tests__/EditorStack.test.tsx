// EditorStack mounts one editor per open file at once: both files' surfaces are present in the DOM with
// their own content, which is what lets a file's artifacts survive switching away and back (the inactive
// editor is kept mounted, not torn down and rebuilt). It also renders the tab strip and drives switching
// and closing through the open-files navigation context.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { EditorStack } from '../EditorStack'
import { OpenFilesContext } from '../OpenFilesContext'
import type { OpenFilesNav } from '../OpenFilesContext'
import { noOpenFiles, type OpenFiles } from '../open-files-logic'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

type StackOptions = {
  readonly repos: FakeRepository
  readonly onActivate?: (path: string) => void
  readonly onClose?: (path: string) => void
}

function renderStack(open: OpenFiles, options: StackOptions): void {
  const nav: OpenFilesNav = {
    activePath: open.active,
    open: options.onActivate ?? vi.fn(),
    openInBackground: vi.fn(),
    close: options.onClose ?? vi.fn()
  }
  render(
    <ReposHarness repos={options.repos}>
      <AgentToolsProvider>
        <ActiveEditorProvider>
          <OpenFilesContext.Provider value={nav}>
            <EditorStack open={open} onOpenSettings={() => undefined} />
          </OpenFilesContext.Provider>
        </ActiveEditorProvider>
      </AgentToolsProvider>
    </ReposHarness>
  )
}

const twoFiles = createFakeFolderRepository({}, { '/a.md': '# Alpha', '/b.md': '# Beta' })

describe('EditorStack', () => {
  it('shows the empty state when no file is open', () => {
    renderStack(noOpenFiles, { repos: createFakeFolderRepository({}) })

    expect(screen.getByText('No file open')).toBeInTheDocument()
    expect(document.querySelector('.ProseMirror')).toBeNull()
  })

  it('keeps an editor mounted for every open file', async () => {
    renderStack({ paths: ['/a.md', '/b.md'], active: '/b.md' }, { repos: twoFiles })

    await waitFor(() => {
      expect(document.querySelectorAll('.ProseMirror h1')).toHaveLength(2)
    })
    const headings = [...document.querySelectorAll('.ProseMirror h1')].map(
      (heading) => heading.textContent
    )
    expect(headings).toContain('Alpha')
    expect(headings).toContain('Beta')
  })

  it('renders a tab per open file and activates one through the context', () => {
    const onActivate = vi.fn()
    renderStack({ paths: ['/a.md', '/b.md'], active: '/a.md' }, { repos: twoFiles, onActivate })

    expect(screen.getByRole('tab', { name: 'a' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'b' }))
    expect(onActivate).toHaveBeenCalledWith('/b.md')
  })

  it('closes a file from its tab through the context', () => {
    const onClose = vi.fn()
    renderStack({ paths: ['/a.md', '/b.md'], active: '/a.md' }, { repos: twoFiles, onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Close b' }))
    expect(onClose).toHaveBeenCalledWith('/b.md')
  })
})
