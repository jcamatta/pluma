// Tracks proposed edits the user reviews before they apply. Proposal ids (p_1, p_2, …) are minted in
// plugin state. The active proposal is shown as a block/span-level red-green decoration; accepting it
// inserts the parsed content, rejecting removes it, and a proposal whose underlying text drifted is
// conflicted.

import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { proposalDecorations } from './proposal-decorations'
import {
  getActiveSuggestionId,
  readSuggestionsUiState,
  setActiveSuggestion
} from './suggestions-ui'

type ProposalStatus = 'ready' | 'conflicted'

type Proposal = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly originalText: string
  readonly replacementText: string
  // Parsed nodes for what to insert; position-free, so mapProposal carries it unchanged.
  readonly content: JSONContent
  readonly status: ProposalStatus
}

type CreateProposalInput = {
  readonly editor: Editor
  readonly proposal: Omit<Proposal, 'id' | 'status'>
}

type CreateProposalResult =
  | { readonly ok: true; readonly proposal: Proposal }
  | { readonly ok: false; readonly error: string }

type ProposalIdInput = {
  readonly editor: Editor
  readonly id: string
}

type SetActiveProposalInput = {
  readonly editor: Editor
  readonly id: string | null
}

type ProposalsState = {
  readonly proposals: readonly Proposal[]
  readonly nextId: number
}

type ProposalCommand =
  | { readonly type: 'add'; readonly proposal: Omit<Proposal, 'id' | 'status'> }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'conflict'; readonly id: string }

const proposalsPluginKey = new PluginKey<ProposalsState>('proposals')

const emptyState: ProposalsState = { proposals: [], nextId: 1 }

function getState(editor: Editor): ProposalsState {
  return proposalsPluginKey.getState(editor.state) ?? emptyState
}

function getProposals(editor: Editor): readonly Proposal[] {
  return getState(editor).proposals
}

// The active suggestion id is shared across proposals and annotations (held in suggestions-ui), so a
// proposal is "active" only when that single id names one of this editor's proposals; otherwise an
// annotation (or nothing) is active and this reader yields null.
function getActiveProposalId(editor: Editor): string | null {
  const activeId = getActiveSuggestionId(editor)
  return activeId !== null && getProposals(editor).some((proposal) => proposal.id === activeId)
    ? activeId
    : null
}

function setActiveProposal({ editor, id }: SetActiveProposalInput): void {
  setActiveSuggestion({ editor, id })
}

function createProposal({ editor, proposal }: CreateProposalInput): CreateProposalResult {
  const overlaps = getProposals(editor).some(
    (existing) => proposal.from < existing.to && existing.from < proposal.to
  )
  if (overlaps) {
    return {
      ok: false,
      error:
        'This range overlaps an existing proposal. Wait for it to be resolved or propose one larger edit.'
    }
  }

  const idBefore = getState(editor).nextId

  editor.view.dispatch(
    editor.state.tr.setMeta(proposalsPluginKey, {
      proposal,
      type: 'add'
    } satisfies ProposalCommand)
  )

  const created = getProposals(editor).find((candidate) => candidate.id === `p_${idBefore}`)
  return created
    ? { ok: true, proposal: created }
    : { ok: true, proposal: { ...proposal, id: `p_${idBefore}`, status: 'ready' } }
}

function rejectProposal({ editor, id }: ProposalIdInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(proposalsPluginKey, { id, type: 'remove' } satisfies ProposalCommand)
  )
}

function acceptProposal({ editor, id }: ProposalIdInput): void {
  const proposal = getProposals(editor).find((candidate) => candidate.id === id)
  if (!proposal || proposal.status === 'conflicted') return

  const currentText = editor.state.doc.textBetween(proposal.from, proposal.to, '\n')

  if (currentText !== proposal.originalText) {
    editor.view.dispatch(
      editor.state.tr.setMeta(proposalsPluginKey, {
        id,
        type: 'conflict'
      } satisfies ProposalCommand)
    )
    return
  }

  // Insert the parsed nodes over [from, to). A single inline-only paragraph is unwrapped to its
  // inline fragment so small edits stay inline (no spurious paragraph split); multi/block content
  // lands as blocks. The chain batches the insertion and the proposal removal into one atomic
  // transaction (one undo step).
  editor
    .chain()
    .insertContentAt({ from: proposal.from, to: proposal.to }, insertionContent(proposal.content))
    .command(({ tr }) => {
      tr.setMeta(proposalsPluginKey, { id, type: 'remove' } satisfies ProposalCommand)
      return true
    })
    .run()
}

// editor.markdown.parse returns a doc node `{ type: 'doc', content: [...] }`. We insert its block
// children; when the parse is a single paragraph we hand back its inline content so the edit merges
// inline instead of forcing a paragraph break.
function insertionContent(content: JSONContent): JSONContent[] {
  const blocks = content.content ?? []
  const only = blocks.length === 1 ? blocks[0] : null
  return only && only.type === 'paragraph' ? (only.content ?? []) : blocks
}

function mapProposal(proposal: Proposal, transaction: Transaction): Proposal {
  return {
    ...proposal,
    from: transaction.mapping.map(proposal.from, 1),
    to: transaction.mapping.map(proposal.to, -1)
  }
}

function isProposalCommand(value: unknown): value is ProposalCommand {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const { type } = value
  return type === 'add' || type === 'remove' || type === 'conflict'
}

function readProposalCommand(transaction: Transaction): ProposalCommand | null {
  const meta: unknown = transaction.getMeta(proposalsPluginKey)
  return isProposalCommand(meta) ? meta : null
}

function reduceProposal(state: ProposalsState, command: ProposalCommand): ProposalsState {
  if (command.type === 'add') {
    return {
      ...state,
      nextId: state.nextId + 1,
      proposals: [
        ...state.proposals,
        { ...command.proposal, id: `p_${state.nextId}`, status: 'ready' }
      ]
    }
  }

  if (command.type === 'conflict') {
    return {
      ...state,
      proposals: state.proposals.map((proposal) =>
        proposal.id === command.id ? { ...proposal, status: 'conflicted' } : proposal
      )
    }
  }

  return {
    ...state,
    proposals: state.proposals.filter((proposal) => proposal.id !== command.id)
  }
}

// When suggestions are visible, every proposal renders its red-green preview at once; hiding them
// clears the set so the manuscript reads clean. Each proposal's own decorations (built by
// proposal-decorations.ts) are flattened into one set.
function visibleDecorations(editorState: EditorState): DecorationSet {
  const ui = readSuggestionsUiState(editorState)
  if (!ui.visible) return DecorationSet.empty

  const state = proposalsPluginKey.getState(editorState) ?? emptyState
  const decorations = state.proposals.flatMap((proposal) =>
    proposalDecorations({
      proposal,
      schema: editorState.schema,
      active: proposal.id === ui.activeId
    })
  )
  return DecorationSet.create(editorState.doc, decorations)
}

// When a proposal occupies an otherwise-empty document its green preview widget sits where the empty
// editor placeholder also renders, so they overlap. Marking the editor DOM lets the stylesheet hide
// the placeholder while a proposal is active.
function editorAttributes(editorState: EditorState): Record<string, string> {
  const { activeId } = readSuggestionsUiState(editorState)
  const state = proposalsPluginKey.getState(editorState) ?? emptyState
  const proposalActive = activeId !== null && state.proposals.some((p) => p.id === activeId)
  return proposalActive ? { class: 'has-active-proposal' } : {}
}

const ProposalsExtension = Extension.create({
  name: 'proposals',

  addProseMirrorPlugins() {
    return [
      new Plugin<ProposalsState>({
        key: proposalsPluginKey,

        state: {
          init() {
            return emptyState
          },

          apply(transaction, state) {
            const mapped: ProposalsState = {
              ...state,
              proposals: state.proposals.map((proposal) => mapProposal(proposal, transaction))
            }
            const command = readProposalCommand(transaction)
            return command ? reduceProposal(mapped, command) : mapped
          }
        },

        props: {
          attributes(editorState) {
            return editorAttributes(editorState)
          },

          decorations(editorState) {
            return visibleDecorations(editorState)
          }
        }
      })
    ]
  }
})

export {
  ProposalsExtension,
  proposalsPluginKey,
  getProposals,
  getActiveProposalId,
  setActiveProposal,
  createProposal,
  rejectProposal,
  acceptProposal
}
export type {
  ProposalStatus,
  Proposal,
  CreateProposalInput,
  CreateProposalResult,
  ProposalIdInput,
  SetActiveProposalInput
}
