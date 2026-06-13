import { describe, expect, it } from 'vitest'
import { noOpenFiles, openFile, closeFile } from '../open-files-logic'

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

  it('closing the only open file empties the set and clears the active file', () => {
    expect(closeFile(openFile(noOpenFiles, '/a.md'), '/a.md')).toEqual(noOpenFiles)
  })

  it('closing an inactive file leaves the active file untouched', () => {
    const opened = openFile(openFile(noOpenFiles, '/a.md'), '/b.md')
    expect(closeFile(opened, '/a.md')).toEqual({ paths: ['/b.md'], active: '/b.md' })
  })

  it('closing the active file falls back to the last remaining open file', () => {
    const opened = openFile(openFile(openFile(noOpenFiles, '/a.md'), '/b.md'), '/c.md')
    expect(closeFile(opened, '/c.md')).toEqual({ paths: ['/a.md', '/b.md'], active: '/b.md' })
  })

  it('closing a folder closes every open file nested under it', () => {
    const opened = openFile(openFile(noOpenFiles, '/notes/a.md'), '/notes/sub/b.md')
    expect(closeFile(opened, '/notes')).toEqual(noOpenFiles)
  })

  it('closing a path that is open nothing leaves the state unchanged by identity', () => {
    const opened = openFile(noOpenFiles, '/a.md')
    expect(closeFile(opened, '/b.md')).toBe(opened)
  })

  it('does not close a sibling whose name only shares a prefix', () => {
    const opened = openFile(openFile(noOpenFiles, '/notes.md'), '/notes-old.md')
    expect(closeFile(opened, '/notes')).toBe(opened)
  })
})
