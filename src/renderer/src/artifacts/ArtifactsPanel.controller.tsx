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
import { ArtifactsList } from './ArtifactsList.view'
import type { Editor } from '@tiptap/core'

function reveal(editor: Editor, from: number): void {
  editor.chain().setTextSelection(from).scrollIntoView().run()
}

function ArtifactsPanelController(): React.JSX.Element {
  const { t } = useTranslation()
  const { editor } = useActiveEditor()
  const { artifacts, activeIds } = useEditorArtifacts()

  const select = (id: string): void => {
    const artifact = artifacts.find((candidate) => candidate.id === id)
    if (!editor || !artifact) return
    if (artifact.kind === 'annotation') setActiveAnnotation({ editor, id })
    else setActiveProposal({ editor, id })
    reveal(editor, artifact.from)
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
