// buildEditorTabs maps the open-files state to one labelled tab per open path, preserving order and
// reusing the editor's basename rule for the label.

import { describe, expect, it } from 'vitest'
import { buildEditorTabs } from '../editor-tabs-logic'
import { noOpenFiles } from '../open-files-logic'

const noCounts: ReadonlyMap<string, number> = new Map()

describe('buildEditorTabs', () => {
  it('returns no tabs for an empty open set', () => {
    expect(
      buildEditorTabs({ open: noOpenFiles, fallback: 'Untitled', pendingCounts: noCounts })
    ).toEqual([])
  })

  it('keeps one tab per open path, in order', () => {
    const tabs = buildEditorTabs({
      open: { paths: ['/a/one.md', '/b/two.md'], active: '/b/two.md' },
      fallback: 'Untitled',
      pendingCounts: noCounts
    })
    expect(tabs.map((tab) => tab.path)).toEqual(['/a/one.md', '/b/two.md'])
  })

  it('labels each tab with the basename, stripped of the .md extension', () => {
    const tabs = buildEditorTabs({
      open: { paths: ['/notes/Act I.md'], active: '/notes/Act I.md' },
      fallback: 'Untitled',
      pendingCounts: noCounts
    })
    expect(tabs[0]).toEqual({ path: '/notes/Act I.md', name: 'Act I', pendingCount: 0 })
  })

  it('falls back to the provided label when the path has no usable basename', () => {
    const tabs = buildEditorTabs({
      open: { paths: ['/dir/.md'], active: '/dir/.md' },
      fallback: 'Untitled',
      pendingCounts: noCounts
    })
    expect(tabs[0]?.name).toBe('Untitled')
  })

  it('stamps each tab with its file pending count, defaulting to zero when absent', () => {
    const tabs = buildEditorTabs({
      open: { paths: ['/a/one.md', '/b/two.md'], active: '/a/one.md' },
      fallback: 'Untitled',
      pendingCounts: new Map([['/a/one.md', 3]])
    })
    expect(tabs.map((tab) => tab.pendingCount)).toEqual([3, 0])
  })
})
