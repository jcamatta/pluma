// Pure merge: fold the editor's annotation and proposal lists into one artifact list ordered by document
// position, so the panel's cards read top-to-bottom like the manuscript. Takes plain arrays (no editor),
// so it is trivially testable.

import type { Annotation } from '../editor/extensions/annotations'
import type { Proposal } from '../editor/extensions/proposals'
import type { Artifact } from './artifact'

function annotationToArtifact(annotation: Annotation): Artifact {
  return {
    kind: 'annotation',
    id: annotation.id,
    from: annotation.from,
    label: annotation.label,
    description: annotation.description,
    severity: annotation.severity,
    quote: annotation.quote
  }
}

function proposalToArtifact(proposal: Proposal): Artifact {
  return {
    kind: 'proposal',
    id: proposal.id,
    from: proposal.from,
    originalText: proposal.originalText,
    replacementText: proposal.replacementText,
    status: proposal.status
  }
}

function toArtifacts(
  annotations: readonly Annotation[],
  proposals: readonly Proposal[]
): readonly Artifact[] {
  return [...annotations.map(annotationToArtifact), ...proposals.map(proposalToArtifact)].sort(
    (left, right) => left.from - right.from
  )
}

export { toArtifacts }
