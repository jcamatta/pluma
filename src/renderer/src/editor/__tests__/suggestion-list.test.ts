// toSuggestionList folds one editor's annotation + proposal lists into one position-ordered list,
// classifies each item (note / insert / rewrite), and counts the items still awaiting the user: pending
// annotations and ready (non-conflicted) proposals.

import { describe, expect, it } from 'vitest'
import type { Annotation, AnnotationStatus } from '../extensions/annotations'
import type { Proposal, ProposalStatus } from '../extensions/proposals'
import { toSuggestionList } from '../suggestion-list'

function annotation(input: {
  readonly id: string
  readonly from: number
  readonly status?: AnnotationStatus
}): Annotation {
  return {
    id: input.id,
    from: input.from,
    to: input.from + 4,
    label: `label-${input.id}`,
    description: `description-${input.id}`,
    severity: 'warning',
    quote: `quote-${input.id}`,
    status: input.status ?? 'pending'
  }
}

function proposal(input: {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly status?: ProposalStatus
}): Proposal {
  return {
    id: input.id,
    from: input.from,
    to: input.to,
    originalText: `before-${input.id}`,
    replacementText: `after-${input.id}`,
    content: { type: 'doc', content: [] },
    status: input.status ?? 'ready'
  }
}

describe('toSuggestionList', () => {
  it('returns nothing when both lists are empty', () => {
    expect(toSuggestionList({ annotations: [], proposals: [] })).toEqual({
      items: [],
      pendingCount: 0
    })
  })

  it('interleaves annotations and proposals by document position', () => {
    const { items } = toSuggestionList({
      annotations: [annotation({ id: 'a_1', from: 30 }), annotation({ id: 'a_2', from: 5 })],
      proposals: [proposal({ id: 'p_1', from: 15, to: 19 })]
    })

    expect(items.map((item) => item.id)).toEqual(['a_2', 'p_1', 'a_1'])
  })

  it('classifies annotations as notes, zero-width proposals as inserts, others as rewrites', () => {
    const { items } = toSuggestionList({
      annotations: [annotation({ id: 'a_1', from: 0 })],
      proposals: [
        proposal({ id: 'p_1', from: 10, to: 10 }),
        proposal({ id: 'p_2', from: 20, to: 26 })
      ]
    })

    const byId = new Map(items.map((item) => [item.id, item.type]))
    expect(byId.get('a_1')).toBe('note')
    expect(byId.get('p_1')).toBe('insert')
    expect(byId.get('p_2')).toBe('rewrite')
  })

  it('carries the preview source: a note label and an edit replacement', () => {
    const { items } = toSuggestionList({
      annotations: [annotation({ id: 'a_1', from: 0 })],
      proposals: [proposal({ id: 'p_1', from: 10, to: 14 })]
    })

    const byId = new Map(items.map((item) => [item.id, item.label]))
    expect(byId.get('a_1')).toBe('label-a_1')
    expect(byId.get('p_1')).toBe('after-p_1')
  })

  it('counts pending: pending notes and ready proposals, excluding read notes and conflicted proposals', () => {
    const { items, pendingCount } = toSuggestionList({
      annotations: [
        annotation({ id: 'a_1', from: 0, status: 'pending' }),
        annotation({ id: 'a_2', from: 30, status: 'read' })
      ],
      proposals: [
        proposal({ id: 'p_1', from: 10, to: 14, status: 'ready' }),
        proposal({ id: 'p_2', from: 40, to: 44, status: 'conflicted' })
      ]
    })

    expect(pendingCount).toBe(2)
    expect(items.filter((item) => item.pending).map((item) => item.id)).toEqual(['a_1', 'p_1'])
  })
})
