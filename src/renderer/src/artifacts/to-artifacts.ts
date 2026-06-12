// Pure merge: fold one file's annotation and proposal lists into a single artifact list ordered by
// document position, stamping each with the owning file's `path` so the panel can label it and resolve
// which editor its commands target. Ordered by `from` so the file's cards read top-to-bottom like the
// manuscript. Takes plain arrays (no editor), so it is trivially testable.

import type { Annotation } from '../editor/extensions/annotations'
import type { Proposal } from '../editor/extensions/proposals'
import type { Artifact } from './artifact'

function annotationToArtifact(path: string, annotation: Annotation): Artifact {
  return {
    kind: 'annotation',
    path,
    id: annotation.id,
    from: annotation.from,
    label: annotation.label,
    description: annotation.description,
    severity: annotation.severity,
    quote: annotation.quote
  }
}

function proposalToArtifact(path: string, proposal: Proposal): Artifact {
  return {
    kind: 'proposal',
    path,
    id: proposal.id,
    from: proposal.from,
    originalText: proposal.originalText,
    replacementText: proposal.replacementText,
    status: proposal.status
  }
}

interface ToArtifactsInput {
  readonly path: string
  readonly annotations: readonly Annotation[]
  readonly proposals: readonly Proposal[]
}

function toArtifacts({ path, annotations, proposals }: ToArtifactsInput): readonly Artifact[] {
  return [
    ...annotations.map((annotation) => annotationToArtifact(path, annotation)),
    ...proposals.map((proposal) => proposalToArtifact(path, proposal))
  ].sort((left, right) => left.from - right.from)
}

export { toArtifacts }
export type { ToArtifactsInput }
