// Pure: pick the element to scroll into view for a DOM node resolved from an editor position
// (editor.view.domAtPos). A text node cannot be scrolled directly, so fall back to its parent element;
// an element node is used as-is. Returns null when there is nothing scrollable to target.

function scrollTargetOf(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement
}

export { scrollTargetOf }
