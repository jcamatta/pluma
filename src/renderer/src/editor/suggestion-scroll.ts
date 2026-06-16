// Move the manuscript "camera" to a suggestion's document position. The editor scrolls inside a Base UI
// ScrollArea viewport that ProseMirror's own scrollIntoView does not reach, so resolve the position to a
// DOM node (editor.view.domAtPos) and scroll that element natively — the browser walks every scrollable
// ancestor and centers the range. A text node cannot be scrolled directly, so fall back to its parent
// element. Mirrors artifacts/scroll-target.ts + ArtifactsPanel.controller's reveal; the duplication is
// intentional and removed with artifacts/ in PR 2.

import type { Editor } from '@tiptap/core'

function scrollTargetOf(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement
}

function reveal(editor: Editor, pos: number): void {
  const { node } = editor.view.domAtPos(pos)
  scrollTargetOf(node)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export { reveal, scrollTargetOf }
