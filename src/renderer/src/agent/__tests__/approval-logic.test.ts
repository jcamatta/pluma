// describeApproval reads the model-supplied (untyped) args of a gated call into the path(s) the card
// shows. A recognized shape yields its kind + paths; anything else — wrong tool name, missing/non-string
// fields — yields the 'unknown' kind so the card falls back to a generic label rather than crashing.

import { describe, expect, it } from 'vitest'
import { describeApproval } from '../approval-logic'

describe('describeApproval', () => {
  it('reads a create_file path', () => {
    expect(describeApproval('create_file', { path: '/a.md' })).toEqual({
      kind: 'create',
      path: '/a.md'
    })
  })

  it('reads a rename_file old/new pair', () => {
    expect(describeApproval('rename_file', { oldPath: '/a.md', newPath: '/b.md' })).toEqual({
      kind: 'rename',
      oldPath: '/a.md',
      newPath: '/b.md'
    })
  })

  it('reads a delete_file path', () => {
    expect(describeApproval('delete_file', { path: '/a.md' })).toEqual({
      kind: 'delete',
      path: '/a.md'
    })
  })

  it('falls back to unknown for an unrecognized tool name', () => {
    expect(describeApproval('mystery', { path: '/a.md' })).toEqual({ kind: 'unknown' })
  })

  it('falls back to unknown when fields are missing or not strings', () => {
    expect(describeApproval('create_file', {})).toEqual({ kind: 'unknown' })
    expect(describeApproval('create_file', { path: 7 })).toEqual({ kind: 'unknown' })
    expect(describeApproval('rename_file', { oldPath: '/a.md' })).toEqual({ kind: 'unknown' })
    expect(describeApproval('delete_file', null)).toEqual({ kind: 'unknown' })
  })
})
