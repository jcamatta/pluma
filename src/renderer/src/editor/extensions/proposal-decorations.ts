// Builds the inline decorations for an active proposal: a word-level diff (insert widgets + delete
// marks) for a ready proposal, or a single conflicted mark when its underlying text drifted.

import { Decoration } from '@tiptap/pm/view'
import { diffWords } from 'diff'
import type { Proposal } from './proposals'

type DiffAccumulator = {
  readonly offset: number
  readonly decorations: readonly Decoration[]
}

function insertDecoration(from: number, value: string): Decoration {
  return Decoration.widget(
    from,
    () => {
      const element = document.createElement('span')
      element.className = 'proposal-insert'
      element.textContent = value
      return element
    },
    { side: 1 }
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
              insertDecoration(proposal.from + acc.offset, part.value)
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
