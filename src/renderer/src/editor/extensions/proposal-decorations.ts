// Builds the inline decorations for an active proposal: a word-level diff (insert widgets + delete
// marks) for a ready proposal, or a single conflicted mark when its underlying text drifted.

import { Decoration } from '@tiptap/pm/view'
import { diffWords } from 'diff'
import type { Proposal } from './proposals'

type DiffAccumulator = {
  readonly offset: number
  readonly decorations: readonly Decoration[]
}

type InsertSpec = {
  readonly from: number
  readonly value: string
  readonly key: string
}

// The key is what lets ProseMirror reuse the widget's DOM node across transactions instead of
// destroying and recreating it on every state change — without it the node remounts each
// transaction and replays its entry animation, which reads as a flicker. It is derived from the
// proposal id and the insert's offset within the original text, both stable across edits (the
// widget's mapped position is not, so it must not feed the key).
function insertDecoration({ from, value, key }: InsertSpec): Decoration {
  return Decoration.widget(
    from,
    () => {
      const element = document.createElement('span')
      element.className = 'proposal-insert'
      element.textContent = value
      return element
    },
    { side: 1, key }
  )
}

function deleteDecoration(from: number, length: number): Decoration {
  return Decoration.inline(from, from + length, { class: 'proposal-delete' })
}

function proposalDecorations(proposal: Proposal): Decoration[] {
  if (proposal.status === 'conflicted') {
    return [Decoration.inline(proposal.from, proposal.to, { class: 'proposal-conflicted' })]
  }

  return diffWords(proposal.originalText, proposal.replacementText)
    .reduce<DiffAccumulator>(
      (acc, part) => {
        if (part.added) {
          return {
            offset: acc.offset,
            decorations: [
              ...acc.decorations,
              insertDecoration({
                from: proposal.from + acc.offset,
                value: part.value,
                key: `${proposal.id}:${acc.offset}`
              })
            ]
          }
        }

        const next = part.removed
          ? [...acc.decorations, deleteDecoration(proposal.from + acc.offset, part.value.length)]
          : acc.decorations

        return { offset: acc.offset + part.value.length, decorations: next }
      },
      { offset: 0, decorations: [] }
    )
    .decorations.slice()
}

export { proposalDecorations }
