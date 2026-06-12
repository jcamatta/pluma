// The plain Data the artifacts panel renders: one discriminated union over the two things the agent
// produces, flattened out of the editor's annotation/proposal plugin state. It carries `from` (the
// document position) so the panel can order cards to read like the manuscript, and `id` to drive the
// editor commands (activate/accept/reject/dismiss). No behavior, no TipTap — just the facts a card needs.

import type { AnnotationSeverity } from '../editor/extensions/annotations'
import type { ProposalStatus } from '../editor/extensions/proposals'

interface AnnotationArtifact {
  readonly kind: 'annotation'
  readonly id: string
  readonly from: number
  readonly label: string
  readonly description: string
  readonly severity: AnnotationSeverity
  readonly quote: string
}

interface ProposalArtifact {
  readonly kind: 'proposal'
  readonly id: string
  readonly from: number
  readonly originalText: string
  readonly replacementText: string
  readonly status: ProposalStatus
}

type Artifact = AnnotationArtifact | ProposalArtifact

export type { Artifact, AnnotationArtifact, ProposalArtifact }
