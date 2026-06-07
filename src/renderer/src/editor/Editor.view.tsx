// Pure editor layout: the zoom container plus the scrollable manuscript surface. Receives the editor
// instance, the current zoom, and the container ref from its controller; holds no hooks of its own.

import { EditorContent, EditorContext, type Editor as TiptapEditor } from '@tiptap/react'
import { type CSSProperties } from 'react'
import { Scrollable } from '../components/Scrollable'

type EditorViewProps = {
  readonly editor: TiptapEditor
  readonly zoom: number
  readonly containerRef: React.RefObject<HTMLDivElement | null>
}

type ZoomStyle = CSSProperties & { readonly '--editor-zoom': number }

export function EditorView({ editor, zoom, containerRef }: EditorViewProps): React.JSX.Element {
  const zoomStyle: ZoomStyle = { '--editor-zoom': zoom }

  return (
    <EditorContext.Provider value={{ editor }}>
      <div ref={containerRef} className="flex h-full min-h-0" style={zoomStyle}>
        <Scrollable
          className="min-h-0 flex-1"
          contentClassName="flex min-h-full px-10 py-10"
          scrollbarClassName="py-4"
        >
          <EditorContent className="flex min-h-full w-full min-w-0 flex-col" editor={editor} />
        </Scrollable>
      </div>
    </EditorContext.Provider>
  )
}
