// Wires the artifacts list to the open files' editors. Reads the produced artifacts + active keys across
// every open editor via useOpenArtifacts, resolves i18n labels, and maps each card interaction to the
// owning editor's own commands: it resolves the artifact's editor by `path`, then selecting activates its
// annotation/proposal decoration and scrolls to it, accept applies the rewrite, reject removes it, dismiss
// removes the annotation. All state lives in the editors — this controller holds none of its own.

import { useTranslation } from 'react-i18next'
import { useActiveEditor } from '../editor/ActiveEditorContext'
import { delAnnotation, setActiveAnnotation } from '../editor/extensions/annotations'
import { acceptProposal, rejectProposal, setActiveProposal } from '../editor/extensions/proposals'
import { useOpenArtifacts } from './useOpenArtifacts'
import { artifactKey } from './artifact-key'
import { scrollTargetOf } from './scroll-target'
import { ArtifactsList } from './ArtifactsList.view'
import type { Editor } from '@tiptap/core'
import type { Artifact } from './artifact'

// Move the manuscript "camera" to the artifact's range. The editor scrolls inside a Base UI ScrollArea
// viewport that ProseMirror's own scrollIntoView does not reach, so scroll the resolved DOM element
// natively — it walks every scrollable ancestor and centers the range.
function reveal(editor: Editor, from: number): void {
  const { node } = editor.view.domAtPos(from)
  scrollTargetOf(node)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function ArtifactsPanelController(): React.JSX.Element {
  const { t } = useTranslation()
  const { editors } = useActiveEditor()
  const { artifacts, activeKeys } = useOpenArtifacts()

  // Selecting a card makes exactly one artifact active in its own editor across both kinds: clear the
  // other kind, then toggle this one. Clicking the active card deselects it (and skips the scroll);
  // selecting a new one reveals its range.
  const select = (artifact: Artifact): void => {
    const editor = editors.get(artifact.path)
    if (!editor) return
    const wasActive = activeKeys.has(artifactKey(artifact))
    if (artifact.kind === 'annotation') {
      setActiveProposal({ editor, id: null })
      setActiveAnnotation({ editor, id: wasActive ? null : artifact.id })
    } else {
      setActiveAnnotation({ editor, id: null })
      setActiveProposal({ editor, id: wasActive ? null : artifact.id })
    }
    if (!wasActive) reveal(editor, artifact.from)
  }

  const accept = (artifact: Artifact): void => {
    const editor = editors.get(artifact.path)
    if (editor) acceptProposal({ editor, id: artifact.id })
  }
  const reject = (artifact: Artifact): void => {
    const editor = editors.get(artifact.path)
    if (editor) rejectProposal({ editor, id: artifact.id })
  }
  const dismiss = (artifact: Artifact): void => {
    const editor = editors.get(artifact.path)
    if (editor) delAnnotation({ editor, id: artifact.id })
  }

  return (
    <ArtifactsList
      artifacts={artifacts}
      activeKeys={activeKeys}
      onSelect={select}
      onAccept={accept}
      onReject={reject}
      onDismiss={dismiss}
      labels={{
        empty: t('artifacts.empty'),
        dismiss: t('artifacts.dismiss'),
        proposedRewrite: t('artifacts.proposedRewrite'),
        conflicted: t('artifacts.conflicted'),
        accept: t('artifacts.accept'),
        reject: t('artifacts.reject')
      }}
    />
  )
}

export { ArtifactsPanelController }
