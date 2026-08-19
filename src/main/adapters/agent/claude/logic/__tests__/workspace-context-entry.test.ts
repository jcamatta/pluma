// Tests for workspaceContextEntry: a workspace root produces one context entry carrying the path
// verbatim (no normalising, no trailing separator, Windows backslashes intact), and the absence of a
// root — undefined or blank — produces nothing rather than asserting a root that does not exist.

import { describe, expect, it } from 'vitest'
import { workspaceContextEntry } from '../workspace-context-entry'

describe('workspaceContextEntry', () => {
  it('produces no entry when no folder is open', () => {
    expect(workspaceContextEntry(undefined)).toBeUndefined()
  })

  it('produces no entry for a blank path', () => {
    expect(workspaceContextEntry('   ')).toBeUndefined()
  })

  it('carries the workspace path verbatim', () => {
    const entry = workspaceContextEntry('C:\\Users\\camat\\Documents\\my-novel')

    expect(entry?.value).toBe('C:\\Users\\camat\\Documents\\my-novel')
  })

  it('describes the value as the workspace root new files belong under', () => {
    const entry = workspaceContextEntry('/home/writer/novel')

    expect(entry?.description).toContain('workspace root')
    expect(entry?.description).toContain('Files you create belong under it')
  })
})
