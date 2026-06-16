// Builds the decorations for an active proposal: a block/span-level red-green preview for a ready
// proposal — the replaced span struck/red and the new content rendered formatted/green in a widget —
// or a single conflicted mark when its underlying text drifted.

import { DOMSerializer, type Schema } from '@tiptap/pm/model'
import { Decoration } from '@tiptap/pm/view'
import type { Proposal } from './proposals'

type ProposalDecorationsInput = {
  readonly proposal: Proposal
  readonly schema: Schema
  readonly active: boolean
}

// Renders the proposal's parsed content (a `{ type: 'doc', content: [...] }` JSON) to real formatted
// DOM via the editor schema, so the preview shows actual headings/lists/paragraphs rather than the
// raw markdown source.
function draftElement({ proposal, schema, active }: ProposalDecorationsInput): HTMLElement {
  const node = schema.nodeFromJSON(proposal.content)
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(node.content)
  const element = document.createElement('div')
  element.className = withActive('proposal-draft', active)
  element.appendChild(fragment)
  return element
}

// The key lets ProseMirror reuse the widget's DOM node across unrelated transactions instead of
// destroying and recreating it on every state change — without it the node remounts each transaction
// and replays its entry animation, which reads as a flicker. The proposal id is stable across edits
// (the widget's mapped position is not, so it must not feed the key).
function draftDecoration(input: ProposalDecorationsInput): Decoration {
  const { proposal, active } = input
  // The active flag is folded into the key so toggling active rebuilds the widget DOM (otherwise
  // ProseMirror reuses the cached node and the proposal-active class never lands on it).
  return Decoration.widget(proposal.to, () => draftElement(input), {
    side: 1,
    key: active ? `${proposal.id}:active` : proposal.id
  })
}

// Appends the active marker class when this proposal is the cross-type active suggestion; the ring it
// styles is wired in a later step, this step only emits the class.
function withActive(className: string, active: boolean): string {
  return active ? `${className} proposal-active` : className
}

function proposalDecorations(input: ProposalDecorationsInput): Decoration[] {
  const { proposal, active } = input
  if (proposal.status === 'conflicted') {
    return [
      Decoration.inline(proposal.from, proposal.to, {
        class: withActive('proposal-conflicted', active)
      })
    ]
  }

  // A pure insert (`from === to`) replaces nothing, so it shows only the green added preview; a
  // replace also strikes the removed span red.
  const removed =
    proposal.from < proposal.to
      ? [
          Decoration.inline(proposal.from, proposal.to, {
            class: withActive('proposal-delete', active)
          })
        ]
      : []

  return [...removed, draftDecoration(input)]
}

export { proposalDecorations }
export type { ProposalDecorationsInput }
