// Pure: pick the element to scroll into view for a DOM position resolved from an editor position
// (editor.view.domAtPos returns a node plus an offset). A text node cannot be scrolled directly, so fall
// back to its parent element — the case for an annotation or a replace, whose range lands inside text. An
// element node means the position sits *between* child nodes: a block boundary, where a pure insert
// (from === to) renders its preview widget. Scroll the child at that offset (the widget, or the adjacent
// block) rather than the container itself, which would otherwise just re-center the whole document.
// Returns null when there is nothing scrollable to target.

function scrollTargetOf(node: Node, offset: number): Element | null {
  if (!(node instanceof Element)) return node.parentElement
  const child = node.childNodes[offset] ?? node.childNodes[offset - 1]
  return child instanceof Element ? child : node
}

export { scrollTargetOf }
