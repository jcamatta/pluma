// Wires the artifacts list to the live editor. Reads the produced artifacts + active ids via
// useEditorArtifacts, resolves i18n labels, and maps each card interaction to the editor's own commands:
// selecting a card activates its annotation/proposal decoration and scrolls the manuscript to it; accept
// applies the rewrite, reject removes it, dismiss removes the annotation. All state lives in the editor —
// this controller holds none of its own.

import { useTranslation } from 'react-i18next'
import { useActiveEditor } from '../editor/ActiveEditorContext'
import { delAnnotation, setActiveAnnotation } from '../editor/extensions/annotations'
import { acceptProposal, rejectProposal, setActiveProposal } from '../editor/extensions/proposals'
import { useEditorArtifacts } from './useEditorArtifacts'
import { scrollTargetOf } from './scroll-target'
import { ArtifactsList } from './ArtifactsList.view'
import type { Editor } from '@tiptap/core'

// Move the manuscript "camera" to the artifact's range. The editor scrolls inside a Base UI ScrollArea
// viewport that ProseMirror's own scrollIntoView does not reach, so scroll the resolved DOM element
// natively — it walks every scrollable ancestor and centers the range.
function reveal(editor: Editor, from: number): void {
  const { node } = editor.view.domAtPos(from)
  scrollTargetOf(node)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function ArtifactsPanelController(): React.JSX.Element {
  const { t } = useTranslation()
  const { editor } = useActiveEditor()
  const { artifacts, activeIds } = useEditorArtifacts()

  // Selecting a card makes exactly one artifact active across both kinds: clear the other kind, then
  // toggle this one. Clicking the active card deselects it (and skips the scroll); selecting a new one
  // reveals its range.
  const select = (id: string): void => {
    const artifact = artifacts.find((candidate) => candidate.id === id)
    if (!editor || !artifact) return
    const wasActive = activeIds.has(id)
    if (artifact.kind === 'annotation') {
      setActiveProposal({ editor, id: null })
      setActiveAnnotation({ editor, id: wasActive ? null : id })
    } else {
      setActiveAnnotation({ editor, id: null })
      setActiveProposal({ editor, id: wasActive ? null : id })
    }
    if (!wasActive) reveal(editor, artifact.from)
  }

  const accept = (id: string): void => {
    if (editor) acceptProposal({ editor, id })
  }
  const reject = (id: string): void => {
    if (editor) rejectProposal({ editor, id })
  }
  const dismiss = (id: string): void => {
    if (editor) delAnnotation({ editor, id })
  }

  return (
    <ArtifactsList
      artifacts={artifacts}
      activeIds={activeIds}
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
