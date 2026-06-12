// The manuscript surface: the zoom container plus the scrollable editor body. Pure — it receives the
// editor instance, the current zoom, and the container ref from the controller and holds no hooks of its
// own. It is the body of the editor panel; the panel chrome (top bar) sits above it in Editor.view.

import { EditorContent, EditorContext, type Editor as TiptapEditor } from '@tiptap/react'
import { type CSSProperties } from 'react'
import { Scrollable } from '../components/Scrollable'
import { SlashMenuController } from './slash/SlashMenu.controller'

type EditorManuscriptProps = {
  readonly editor: TiptapEditor
  readonly zoom: number
  readonly containerRef: React.RefObject<HTMLDivElement | null>
}

type ZoomStyle = CSSProperties & { readonly '--editor-zoom': number }

export function EditorManuscript({
  editor,
  zoom,
  containerRef
}: EditorManuscriptProps): React.JSX.Element {
  const zoomStyle: ZoomStyle = { '--editor-zoom': zoom }

  return (
    <EditorContext.Provider value={{ editor }}>
      <div ref={containerRef} className="flex min-h-0 flex-1" style={zoomStyle}>
        <Scrollable
          className="min-h-0 flex-1"
          contentClassName="flex min-h-full px-10 py-10"
          scrollbarClassName="py-4"
        >
          <EditorContent className="flex min-h-full w-full min-w-0 flex-col" editor={editor} />
        </Scrollable>
      </div>
      <SlashMenuController editor={editor} />
    </EditorContext.Provider>
  )
}
