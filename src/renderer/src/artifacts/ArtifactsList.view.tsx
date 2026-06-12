// The list of artifact cards the agent produced, in document order — annotations and proposals rendered
// by their card, the active one highlighted. Cards animate in/out via AnimatePresence as the agent adds
// them or the user resolves them. Empty before the first run. Pure props: every interaction is a callback
// keyed by artifact id, which the controller maps to the editor commands.

import { StickyNote } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { Empty } from '../rail/Empty.view'
import { AnnotationCard } from './AnnotationCard.view'
import { ProposalCard } from './ProposalCard.view'
import type { Artifact } from './artifact'

interface ArtifactsListLabels {
  readonly empty: string
  readonly dismiss: string
  readonly proposedRewrite: string
  readonly conflicted: string
  readonly accept: string
  readonly reject: string
}

interface ArtifactsListProps {
  readonly artifacts: readonly Artifact[]
  readonly activeIds: ReadonlySet<string>
  readonly onSelect: (id: string) => void
  readonly onAccept: (id: string) => void
  readonly onReject: (id: string) => void
  readonly onDismiss: (id: string) => void
  readonly labels: ArtifactsListLabels
}

function ArtifactsList({
  artifacts,
  activeIds,
  onSelect,
  onAccept,
  onReject,
  onDismiss,
  labels
}: ArtifactsListProps): React.JSX.Element {
  if (artifacts.length === 0) {
    return <Empty icon={<StickyNote size={22} />} text={labels.empty} />
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <AnimatePresence initial={false}>
        {artifacts.map((artifact) =>
          artifact.kind === 'annotation' ? (
            <AnnotationCard
              key={artifact.id}
              artifact={artifact}
              active={activeIds.has(artifact.id)}
              onClick={() => onSelect(artifact.id)}
              onDismiss={() => onDismiss(artifact.id)}
              labels={{ dismiss: labels.dismiss }}
            />
          ) : (
            <ProposalCard
              key={artifact.id}
              artifact={artifact}
              active={activeIds.has(artifact.id)}
              onClick={() => onSelect(artifact.id)}
              onAccept={() => onAccept(artifact.id)}
              onReject={() => onReject(artifact.id)}
              labels={{
                proposedRewrite: labels.proposedRewrite,
                conflicted: labels.conflicted,
                accept: labels.accept,
                reject: labels.reject
              }}
            />
          )
        )}
      </AnimatePresence>
    </div>
  )
}

export { ArtifactsList }
export type { ArtifactsListProps, ArtifactsListLabels }
