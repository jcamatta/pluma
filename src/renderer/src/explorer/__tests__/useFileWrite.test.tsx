// useFileWrite against an in-memory fake repository: it writes a file's content through the fileWriter
// port and returns the typed Result. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFileWrite } from '../useFileWrite'
import { createFakeFolderRepository } from './fake-folder-repository'
import type { FakeRepository } from './fake-folder-repository'
import { ReposHarness } from './render-with-repos'

function renderUseFileWrite(
  repos: FakeRepository
): ReturnType<typeof renderHook<ReturnType<typeof useFileWrite>, void>> {
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ReposHarness repos={repos}>{children}</ReposHarness>
  )
  return renderHook(() => useFileWrite(), { wrapper })
}

describe('useFileWrite', () => {
  it('writes content through the file writer port', async () => {
    const repos = createFakeFolderRepository({})
    const { result } = renderUseFileWrite(repos)

    const outcome = await result.current('/root/a.md', '# Edited')

    expect(outcome).toEqual({ ok: true, value: '/root/a.md' })
    expect(repos.written()).toEqual([{ path: '/root/a.md', content: '# Edited' }])
  })
})
