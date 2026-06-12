// The plain Data the artifacts panel renders: one discriminated union over the two things the agent
// produces, flattened out of the editors' annotation/proposal plugin state. `path` (the owning file) and
// `id` (minted per editor) together identify it across files; `from` (the document position) orders cards
// to read like the manuscript. No behavior, no TipTap — just the facts a card needs.

import type { AnnotationSeverity } from '../editor/extensions/annotations'
import type { ProposalStatus } from '../editor/extensions/proposals'

interface AnnotationArtifact {
  readonly kind: 'annotation'
  readonly path: string
  readonly id: string
  readonly from: number
  readonly label: string
  readonly description: string
  readonly severity: AnnotationSeverity
  readonly quote: string
}

interface ProposalArtifact {
  readonly kind: 'proposal'
  readonly path: string
  readonly id: string
  readonly from: number
  readonly originalText: string
  readonly replacementText: string
  readonly status: ProposalStatus
}

type Artifact = AnnotationArtifact | ProposalArtifact

export type { Artifact, AnnotationArtifact, ProposalArtifact }
