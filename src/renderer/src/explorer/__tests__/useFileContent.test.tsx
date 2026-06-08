// useFileContent against an in-memory fake repository: it reads a file's content through the fileReader
// port, leaves the query disabled (no read) when nothing is selected, and surfaces a typed ok: false
// when the file is missing. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFileContent } from '../useFileContent'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'
import { ReposHarness } from './render-with-repos'

function renderUseFileContent(
  repos: FakeRepository,
  path: string | null
): ReturnType<typeof renderHook<ReturnType<typeof useFileContent>, void>> {
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ReposHarness repos={repos}>{children}</ReposHarness>
  )
  return renderHook(() => useFileContent(path), { wrapper })
}

describe('useFileContent', () => {
  it('reads the selected file content', async () => {
    const repos = createFakeFolderRepository({}, { '/root/a.md': '# Chapter One' })
    const { result } = renderUseFileContent(repos, '/root/a.md')

    await waitFor(() => {
      expect(result.current).toEqual({ ok: true, value: '# Chapter One' })
    })
  })

  it('does not read when no file is selected', () => {
    const repos = createFakeFolderRepository({}, {})
    const readSpy = vi.spyOn(repos.fileReader, 'read')
    const { result } = renderUseFileContent(repos, null)

    expect(result.current).toBeUndefined()
    expect(readSpy).not.toHaveBeenCalled()
  })

  it('surfaces a typed ok: false for a missing file', async () => {
    const repos = createFakeFolderRepository({}, {})
    const { result } = renderUseFileContent(repos, '/root/missing.md')

    await waitFor(() => {
      expect(result.current).toEqual({
        ok: false,
        error: { _tag: 'FileNotFound', path: '/root/missing.md' }
      })
    })
  })
})
