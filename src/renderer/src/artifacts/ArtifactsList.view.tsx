// The list of artifact cards the agent produced, grouped by file and in document order — annotations and
// proposals rendered by their card, the active one highlighted. Cards animate in/out via AnimatePresence
// as the agent adds them or the user resolves them. Empty before the first run. Pure props: every
// interaction passes the whole artifact back, which the controller maps to its editor's commands; identity
// is the composite `path::id` key, since ids are only unique within one file's editor.

import { StickyNote } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { Empty } from '../rail/Empty.view'
import { AnnotationCard } from './AnnotationCard.view'
import { ProposalCard } from './ProposalCard.view'
import { artifactKey } from './artifact-key'
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
  readonly activeKeys: ReadonlySet<string>
  readonly onSelect: (artifact: Artifact) => void
  readonly onAccept: (artifact: Artifact) => void
  readonly onReject: (artifact: Artifact) => void
  readonly onDismiss: (artifact: Artifact) => void
  readonly labels: ArtifactsListLabels
}

function ArtifactsList({
  artifacts,
  activeKeys,
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
              key={artifactKey(artifact)}
              artifact={artifact}
              active={activeKeys.has(artifactKey(artifact))}
              onClick={() => onSelect(artifact)}
              onDismiss={() => onDismiss(artifact)}
              labels={{ dismiss: labels.dismiss }}
            />
          ) : (
            <ProposalCard
              key={artifactKey(artifact)}
              artifact={artifact}
              active={activeKeys.has(artifactKey(artifact))}
              onClick={() => onSelect(artifact)}
              onAccept={() => onAccept(artifact)}
              onReject={() => onReject(artifact)}
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
