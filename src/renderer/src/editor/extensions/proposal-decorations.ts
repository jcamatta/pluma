// Builds the decorations for an active proposal: a block/span-level red-green preview for a ready
// proposal — the replaced span struck/red and the new content rendered formatted/green in a widget —
// or a single conflicted mark when its underlying text drifted.

import { DOMSerializer, type Schema } from '@tiptap/pm/model'
import { Decoration } from '@tiptap/pm/view'
import type { Proposal } from './proposals'

// Renders the proposal's parsed content (a `{ type: 'doc', content: [...] }` JSON) to real formatted
// DOM via the editor schema, so the preview shows actual headings/lists/paragraphs rather than the
// raw markdown source.
function draftElement(proposal: Proposal, schema: Schema): HTMLElement {
  const node = schema.nodeFromJSON(proposal.content)
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(node.content)
  const element = document.createElement('div')
  element.className = 'proposal-draft'
  element.appendChild(fragment)
  return element
}

// The key lets ProseMirror reuse the widget's DOM node across unrelated transactions instead of
// destroying and recreating it on every state change — without it the node remounts each transaction
// and replays its entry animation, which reads as a flicker. The proposal id is stable across edits
// (the widget's mapped position is not, so it must not feed the key).
function draftDecoration(proposal: Proposal, schema: Schema): Decoration {
  return Decoration.widget(proposal.to, () => draftElement(proposal, schema), {
    side: 1,
    key: proposal.id
  })
}

function proposalDecorations(proposal: Proposal, schema: Schema): Decoration[] {
  if (proposal.status === 'conflicted') {
    return [Decoration.inline(proposal.from, proposal.to, { class: 'proposal-conflicted' })]
  }

  // A pure insert (`from === to`) replaces nothing, so it shows only the green added preview; a
  // replace also strikes the removed span red.
  const removed =
    proposal.from < proposal.to
      ? [Decoration.inline(proposal.from, proposal.to, { class: 'proposal-delete' })]
      : []

  return [...removed, draftDecoration(proposal, schema)]
}

export { proposalDecorations }
