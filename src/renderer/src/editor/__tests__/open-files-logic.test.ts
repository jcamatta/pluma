import { describe, expect, it } from 'vitest'
import { noOpenFiles, openFile } from '../open-files-logic'

describe('open-files logic', () => {
  it('opens a file: adds it and makes it active', () => {
    expect(openFile(noOpenFiles, '/a.md')).toEqual({ paths: ['/a.md'], active: '/a.md' })
  })

  it('keeps every opened file mounted and activates the latest', () => {
    const opened = openFile(openFile(noOpenFiles, '/a.md'), '/b.md')
    expect(opened).toEqual({ paths: ['/a.md', '/b.md'], active: '/b.md' })
  })

  it('reopening an already-open file does not duplicate it, only reactivates', () => {
    const opened = openFile(openFile(openFile(noOpenFiles, '/a.md'), '/b.md'), '/a.md')
    expect(opened).toEqual({ paths: ['/a.md', '/b.md'], active: '/a.md' })
  })
})
