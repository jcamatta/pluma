// Wires the artifacts list to the open files' editors. Reads the produced artifacts + active keys across
// every open editor via useOpenArtifacts, resolves i18n labels, and maps each card interaction to the
// owning editor's own commands. Selecting resolves the artifact's editor by `path` and activates its
// decoration; when the artifact belongs to the active file it scrolls to the range immediately, and when
// it belongs to another open file it asks the shell to make that file active, then reveals the range once
// the editor is shown (a hidden editor cannot be scrolled). Accept/reject/dismiss act on the owning editor.

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveEditor } from '../editor/ActiveEditorContext'
import { useOpenFiles } from '../editor/OpenFilesContext'
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

// Make exactly one artifact active in its own editor across both kinds: clear the other kind, then toggle
// this one (clicking the active card deselects it).
function activate({
  editor,
  artifact,
  wasActive
}: {
  readonly editor: Editor
  readonly artifact: Artifact
  readonly wasActive: boolean
}): void {
  if (artifact.kind === 'annotation') {
    setActiveProposal({ editor, id: null })
    setActiveAnnotation({ editor, id: wasActive ? null : artifact.id })
  } else {
    setActiveAnnotation({ editor, id: null })
    setActiveProposal({ editor, id: wasActive ? null : artifact.id })
  }
}

function ArtifactsPanelController(): React.JSX.Element {
  const { t } = useTranslation()
  const { editors } = useActiveEditor()
  const { activePath, open } = useOpenFiles()
  const { artifacts, activeKeys } = useOpenArtifacts()
  const pendingReveal = useRef<{ readonly path: string; readonly from: number } | null>(null)

  useEffect(() => {
    const pending = pendingReveal.current
    if (!pending || pending.path !== activePath) return
    const editor = editors.get(pending.path)
    if (editor) reveal(editor, pending.from)
    pendingReveal.current = null
  }, [activePath, editors])

  const select = (artifact: Artifact): void => {
    const editor = editors.get(artifact.path)
    if (!editor) return
    const wasActive = activeKeys.has(artifactKey(artifact))
    activate({ editor, artifact, wasActive })
    if (wasActive) return
    if (artifact.path === activePath) {
      reveal(editor, artifact.from)
    } else {
      pendingReveal.current = { path: artifact.path, from: artifact.from }
      open(artifact.path)
    }
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
