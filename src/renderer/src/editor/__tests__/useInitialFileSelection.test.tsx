import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useInitialFileSelection } from '../useInitialFileSelection'
import { OpenFilesContext } from '../OpenFilesContext'
import { ReposHarness } from '../../explorer/__tests__/render-with-repos'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'

function Providers({
  repos,
  opened,
  children
}: {
  readonly repos: FakeRepository
  readonly opened: string[]
  readonly children: ReactNode
}): React.JSX.Element {
  return (
    <ReposHarness repos={repos}>
      <OpenFilesContext.Provider value={{ activePath: null, open: (path) => opened.push(path) }}>
        {children}
      </OpenFilesContext.Provider>
    </ReposHarness>
  )
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('useInitialFileSelection', () => {
  it('opens the first markdown file once the root listing resolves', async () => {
    const repos = createFakeFolderRepository({
      '/root': [
        { name: 'beta.md', type: 'file' },
        { name: 'alpha.md', type: 'file' }
      ]
    })
    const opened: string[] = []
    const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
      <Providers repos={repos} opened={opened}>
        {children}
      </Providers>
    )
    renderHook(() => useInitialFileSelection('/root'), { wrapper })

    await waitFor(() => expect(opened).toEqual(['/root/alpha.md']))
  })

  it('opens nothing when the root has no markdown file', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'notes.txt', type: 'file' }] })
    const opened: string[] = []
    const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
      <Providers repos={repos} opened={opened}>
        {children}
      </Providers>
    )
    renderHook(() => useInitialFileSelection('/root'), { wrapper })

    await settle()
    expect(opened).toEqual([])
  })

  it('fires once even across re-renders', async () => {
    const repos = createFakeFolderRepository({ '/root': [{ name: 'alpha.md', type: 'file' }] })
    const opened: string[] = []
    const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
      <Providers repos={repos} opened={opened}>
        {children}
      </Providers>
    )
    const { rerender } = renderHook(() => useInitialFileSelection('/root'), { wrapper })

    await waitFor(() => expect(opened).toEqual(['/root/alpha.md']))
    rerender()
    await settle()
    expect(opened).toEqual(['/root/alpha.md'])
  })
})
