import { describe, expect, it } from 'vitest'
import { reconcileFileContent } from '../reconcile-file-content'

describe('reconcileFileContent', () => {
  it('skips when disk matches the baseline (idle, and self-write echo)', () => {
    expect(reconcileFileContent('# Chapter', '# Chapter')).toBe('skip')
  })

  it('applies when disk diverges from the baseline (external change)', () => {
    expect(reconcileFileContent('# Chapter edited', '# Chapter')).toBe('apply')
  })

  it('applies when nothing has been synced yet (first load)', () => {
    expect(reconcileFileContent('# Chapter', null)).toBe('apply')
  })
})
