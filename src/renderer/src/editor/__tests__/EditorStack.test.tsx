// EditorStack mounts one editor per open file at once: both files' surfaces are present in the DOM
// with their own content, which is what lets a file's artifacts survive switching away and back (the
// inactive editor is kept mounted, not torn down and rebuilt).

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { EditorStack } from '../EditorStack'
import { noOpenFiles } from '../open-files-logic'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'

describe('EditorStack', () => {
  it('shows the empty state when no file is open', () => {
    const repos = createFakeFolderRepository({})
    render(
      <ReposHarness repos={repos}>
        <AgentToolsProvider>
          <ActiveEditorProvider>
            <EditorStack open={noOpenFiles} onOpenSettings={() => undefined} />
          </ActiveEditorProvider>
        </AgentToolsProvider>
      </ReposHarness>
    )

    expect(screen.getByText('No file open')).toBeInTheDocument()
    expect(document.querySelector('.ProseMirror')).toBeNull()
  })

  it('keeps an editor mounted for every open file', async () => {
    const repos = createFakeFolderRepository({}, { '/a.md': '# Alpha', '/b.md': '# Beta' })
    const { container } = render(
      <ReposHarness repos={repos}>
        <AgentToolsProvider>
          <ActiveEditorProvider>
            <EditorStack
              open={{ paths: ['/a.md', '/b.md'], active: '/b.md' }}
              onOpenSettings={() => undefined}
            />
          </ActiveEditorProvider>
        </AgentToolsProvider>
      </ReposHarness>
    )

    await waitFor(() => {
      const headings = [...container.querySelectorAll('.ProseMirror h1')].map(
        (heading) => heading.textContent
      )
      expect(headings).toContain('Alpha')
      expect(headings).toContain('Beta')
    })
  })
})
