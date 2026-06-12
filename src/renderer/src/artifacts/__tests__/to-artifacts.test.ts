// toArtifacts flattens one file's annotation + proposal lists into one artifact list ordered by document
// position, stamping the owning file's path and carrying through the fields each card needs.

import { describe, expect, it } from 'vitest'
import type { Annotation } from '../../editor/extensions/annotations'
import type { Proposal } from '../../editor/extensions/proposals'
import { toArtifacts } from '../to-artifacts'

function annotation(id: string, from: number): Annotation {
  return {
    id,
    from,
    to: from + 4,
    label: `label-${id}`,
    description: `description-${id}`,
    severity: 'warning',
    quote: `quote-${id}`
  }
}

function proposal(id: string, from: number): Proposal {
  return {
    id,
    from,
    to: from + 4,
    originalText: `before-${id}`,
    replacementText: `after-${id}`,
    status: 'ready'
  }
}

describe('toArtifacts', () => {
  it('returns nothing when both lists are empty', () => {
    expect(toArtifacts({ path: '/a.md', annotations: [], proposals: [] })).toEqual([])
  })

  it('interleaves annotations and proposals by document position', () => {
    const result = toArtifacts({
      path: '/a.md',
      annotations: [annotation('a_1', 30), annotation('a_2', 5)],
      proposals: [proposal('p_1', 15)]
    })

    expect(result.map((artifact) => artifact.id)).toEqual(['a_2', 'p_1', 'a_1'])
    expect(result.map((artifact) => artifact.kind)).toEqual([
      'annotation',
      'proposal',
      'annotation'
    ])
  })

  it('stamps the path and maps each kind to the fields its card needs', () => {
    const [annotationArtifact, proposalArtifact] = toArtifacts({
      path: '/chapter.md',
      annotations: [annotation('a_1', 0)],
      proposals: [proposal('p_1', 10)]
    })

    expect(annotationArtifact).toEqual({
      kind: 'annotation',
      path: '/chapter.md',
      id: 'a_1',
      from: 0,
      label: 'label-a_1',
      description: 'description-a_1',
      severity: 'warning',
      quote: 'quote-a_1'
    })
    expect(proposalArtifact).toEqual({
      kind: 'proposal',
      path: '/chapter.md',
      id: 'p_1',
      from: 10,
      originalText: 'before-p_1',
      replacementText: 'after-p_1',
      status: 'ready'
    })
  })
})
