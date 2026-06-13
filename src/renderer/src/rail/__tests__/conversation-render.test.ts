// applyRunStatus overlays the live run status onto projected rows: only the last assistant row reflects
// working/error, prior assistant rows stay 'done', and a live run with no assistant row yet gets a
// synthetic pending row so the thinking affordance shows. defaultExpanded opens live rows, collapses
// settled ones.

import { describe, expect, it } from 'vitest'
import { applyRunStatus, defaultExpanded } from '../conversation-render'
import type { Row } from '../conversation-rows'

const user = (id: string): Row => ({ kind: 'user', id, text: `prompt ${id}` })
const assistant = (id: string): Row => ({ kind: 'assistant', id, text: `reply ${id}`, steps: [] })

describe('applyRunStatus', () => {
  it('settles every row when the run is done', () => {
    const rows = [user('u1'), assistant('a1'), user('u2'), assistant('a2')]
    expect(applyRunStatus(rows, 'done').map((r) => r.status)).toEqual([
      'done',
      'done',
      'done',
      'done'
    ])
  })

  it('marks only the last assistant row working, leaving prior turns settled', () => {
    const rows = [user('u1'), assistant('a1'), user('u2'), assistant('a2')]
    const out = applyRunStatus(rows, 'working')
    expect(out.map((r) => r.status)).toEqual(['done', 'done', 'done', 'working'])
    expect(out.at(-1)?.row.id).toBe('a2')
  })

  it('appends a synthetic pending row when a live run has no assistant message yet', () => {
    const rows = [user('u1'), assistant('a1'), user('u2')]
    const out = applyRunStatus(rows, 'working')
    expect(out).toHaveLength(4)
    const pending = out.at(-1)
    expect(pending?.status).toBe('working')
    expect(pending?.row).toEqual({ kind: 'assistant', id: 'pending', text: '', steps: [] })
    expect(out.slice(0, 3).map((r) => r.status)).toEqual(['done', 'done', 'done'])
  })

  it('appends a pending error row when a run fails before producing an assistant message', () => {
    const out = applyRunStatus([user('u1')], 'error')
    expect(out).toHaveLength(2)
    expect(out.at(-1)?.status).toBe('error')
  })

  it('returns no rows for an empty conversation', () => {
    expect(applyRunStatus([], 'done')).toEqual([])
    expect(applyRunStatus([], 'working')).toHaveLength(1)
  })
})

describe('defaultExpanded', () => {
  it('opens live rows and collapses settled ones', () => {
    expect(defaultExpanded('working')).toBe(true)
    expect(defaultExpanded('error')).toBe(true)
    expect(defaultExpanded('done')).toBe(false)
    expect(defaultExpanded('idle')).toBe(false)
  })
})
