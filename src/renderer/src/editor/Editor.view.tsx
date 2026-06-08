// The editor panel layout: the top bar (file name + settings) above the manuscript surface, matching the
// design's editor pane. Pure — every value comes through props from the controller, and it holds no hooks
// of its own. The two pieces it composes, EditorTopBar and EditorManuscript, own their own markup.

import { type Editor as TiptapEditor } from '@tiptap/react'
import { EditorTopBar } from './EditorTopBar'
import { EditorManuscript } from './EditorManuscript'

type EditorViewProps = {
  readonly editor: TiptapEditor
  readonly zoom: number
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly fileName: string
  readonly settingsLabel: string
  readonly onOpenSettings: () => void
}

export function EditorView({
  editor,
  zoom,
  containerRef,
  fileName,
  settingsLabel,
  onOpenSettings
}: EditorViewProps): React.JSX.Element {
  return (
    <>
      <EditorTopBar
        fileName={fileName}
        settingsLabel={settingsLabel}
        onOpenSettings={onOpenSettings}
      />
      <EditorManuscript editor={editor} zoom={zoom} containerRef={containerRef} />
    </>
  )
}
