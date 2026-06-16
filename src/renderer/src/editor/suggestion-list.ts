// Pure merge of one editor's annotation and proposal lists into a single suggestion list ordered by
// document position, each item classified by display type — `note` (annotation), `insert` (a zero-width
// proposal, `from === to`), or `rewrite` (any other proposal). Takes plain arrays (no editor), so the tab
// badge can run it over every open editor and the single-editor hook can run it over the active one from
// the same source. Mirrors artifacts/to-artifacts.ts; the duplication is intentional and removed with
// artifacts/ in PR 2.
//
// `pending` counts the items still awaiting the user: an annotation is pending while its status is
// 'pending' (a 'read' note is resolved), and a proposal is pending while it is 'ready' (accepting or
// rejecting removes it from plugin state, and a 'conflicted' proposal can no longer be plain-accepted, so
// neither counts as awaiting review).

import type { Annotation } from './extensions/annotations'
import type { Proposal } from './extensions/proposals'

type SuggestionType = 'rewrite' | 'insert' | 'note'

type Suggestion = {
  readonly id: string
  readonly type: SuggestionType
  readonly from: number
  readonly to: number
  readonly pending: boolean
  // One-line source the sub-topbar/list preview reads: a note's label, an edit's replacement text.
  readonly label: string
}

interface SuggestionListInput {
  readonly annotations: readonly Annotation[]
  readonly proposals: readonly Proposal[]
}

interface SuggestionList {
  readonly items: readonly Suggestion[]
  readonly pendingCount: number
}

function annotationToSuggestion(annotation: Annotation): Suggestion {
  return {
    id: annotation.id,
    type: 'note',
    from: annotation.from,
    to: annotation.to,
    pending: annotation.status === 'pending',
    label: annotation.label
  }
}

function proposalToSuggestion(proposal: Proposal): Suggestion {
  return {
    id: proposal.id,
    type: proposal.from === proposal.to ? 'insert' : 'rewrite',
    from: proposal.from,
    to: proposal.to,
    pending: proposal.status === 'ready',
    label: proposal.replacementText
  }
}

function toSuggestionList({ annotations, proposals }: SuggestionListInput): SuggestionList {
  const items = [
    ...annotations.map(annotationToSuggestion),
    ...proposals.map(proposalToSuggestion)
  ].sort((left, right) => left.from - right.from)
  return { items, pendingCount: items.filter((item) => item.pending).length }
}

export { toSuggestionList }
export type { Suggestion, SuggestionType, SuggestionList, SuggestionListInput }
