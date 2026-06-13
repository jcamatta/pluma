// buildEditorTabs maps the open-files state to one labelled tab per open path, preserving order and
// reusing the editor's basename rule for the label.

import { describe, expect, it } from 'vitest'
import { buildEditorTabs } from '../editor-tabs-logic'
import { noOpenFiles } from '../open-files-logic'

describe('buildEditorTabs', () => {
  it('returns no tabs for an empty open set', () => {
    expect(buildEditorTabs(noOpenFiles, 'Untitled')).toEqual([])
  })

  it('keeps one tab per open path, in order', () => {
    const tabs = buildEditorTabs(
      { paths: ['/a/one.md', '/b/two.md'], active: '/b/two.md' },
      'Untitled'
    )
    expect(tabs.map((tab) => tab.path)).toEqual(['/a/one.md', '/b/two.md'])
  })

  it('labels each tab with the basename, stripped of the .md extension', () => {
    const tabs = buildEditorTabs(
      { paths: ['/notes/Act I.md'], active: '/notes/Act I.md' },
      'Untitled'
    )
    expect(tabs[0]).toEqual({ path: '/notes/Act I.md', name: 'Act I' })
  })

  it('falls back to the provided label when the path has no usable basename', () => {
    const tabs = buildEditorTabs({ paths: ['/dir/.md'], active: '/dir/.md' }, 'Untitled')
    expect(tabs[0]?.name).toBe('Untitled')
  })
})
