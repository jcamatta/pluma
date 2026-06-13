import { describe, expect, it } from 'vitest'
import { isUnderOrEqual, remapOpenPaths, remapPath } from '../explorer-subtree-remap'

describe('isUnderOrEqual', () => {
  it('matches the root itself', () => {
    expect(isUnderOrEqual('/notes/draft', '/notes/draft')).toBe(true)
  })

  it('matches a descendant', () => {
    expect(isUnderOrEqual('/notes/draft/ch1', '/notes/draft')).toBe(true)
  })

  it('does not match a sibling that shares a name prefix', () => {
    expect(isUnderOrEqual('/notes/draft-2', '/notes/draft')).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(isUnderOrEqual('/other/file', '/notes/draft')).toBe(false)
  })

  it('matches Windows descendants', () => {
    expect(isUnderOrEqual('C:\\notes\\draft\\ch1', 'C:\\notes\\draft')).toBe(true)
  })
})

describe('remapPath', () => {
  it('rewrites the root onto the new root', () => {
    expect(remapPath('/notes/draft', { from: '/notes/draft', to: '/notes/final' })).toBe(
      '/notes/final'
    )
  })

  it('rewrites a descendant, preserving the tail', () => {
    expect(
      remapPath('/notes/draft/ch1/a.md', { from: '/notes/draft', to: '/notes/final' })
    ).toBe('/notes/final/ch1/a.md')
  })

  it('leaves a path outside the subtree untouched', () => {
    expect(remapPath('/notes/other', { from: '/notes/draft', to: '/notes/final' })).toBe(
      '/notes/other'
    )
  })

  it('rewrites Windows paths', () => {
    expect(
      remapPath('C:\\notes\\draft\\ch1', { from: 'C:\\notes\\draft', to: 'C:\\notes\\final' })
    ).toBe('C:\\notes\\final\\ch1')
  })
})

describe('remapOpenPaths', () => {
  it('remaps only the affected paths and keeps the rest', () => {
    const open = new Set(['/notes/draft', '/notes/draft/ch1', '/notes/other'])
    const next = remapOpenPaths(open, { from: '/notes/draft', to: '/notes/final' })

    expect([...next].sort()).toStrictEqual(['/notes/final', '/notes/final/ch1', '/notes/other'])
  })
})
