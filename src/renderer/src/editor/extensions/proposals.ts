// Tracks proposed inline edits the user reviews before they apply. Proposal ids (p_1, p_2, …) are
// minted in plugin state. The active proposal is shown as a word-level diff decoration; accepting it
// replaces the text, rejecting removes it, and a proposal whose underlying text drifted is conflicted.

import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { proposalDecorations } from './proposal-decorations'

type ProposalStatus = 'ready' | 'conflicted'

type Proposal = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly originalText: string
  readonly replacementText: string
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
  readonly activeId: string | null
  readonly nextId: number
}

type ProposalCommand =
  | { readonly type: 'add'; readonly proposal: Omit<Proposal, 'id' | 'status'> }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'conflict'; readonly id: string }
  | { readonly type: 'activate'; readonly id: string | null }

const proposalsPluginKey = new PluginKey<ProposalsState>('proposals')

const emptyState: ProposalsState = { proposals: [], activeId: null, nextId: 1 }

function getState(editor: Editor): ProposalsState {
  return proposalsPluginKey.getState(editor.state) ?? emptyState
}

function getProposals(editor: Editor): readonly Proposal[] {
  return getState(editor).proposals
}

function getActiveProposalId(editor: Editor): string | null {
  return getState(editor).activeId
}

function setActiveProposal({ editor, id }: SetActiveProposalInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(proposalsPluginKey, {
      id,
      type: 'activate'
    } satisfies ProposalCommand)
  )
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

  editor.view.dispatch(
    editor.state.tr
      .insertText(proposal.replacementText, proposal.from, proposal.to)
      .setMeta(proposalsPluginKey, { id, type: 'remove' } satisfies ProposalCommand)
  )
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
  return type === 'add' || type === 'remove' || type === 'conflict' || type === 'activate'
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

  if (command.type === 'activate') {
    return { ...state, activeId: command.id }
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
    proposals: state.proposals.filter((proposal) => proposal.id !== command.id),
    activeId: state.activeId === command.id ? null : state.activeId
  }
}

function activeDecorations(state: ProposalsState, doc: ProseMirrorNode): DecorationSet {
  if (!state.activeId) return DecorationSet.empty

  const active = state.proposals.find((proposal) => proposal.id === state.activeId)
  if (!active) return DecorationSet.empty

  return DecorationSet.create(doc, proposalDecorations(active))
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
          decorations(editorState) {
            return activeDecorations(
              proposalsPluginKey.getState(editorState) ?? emptyState,
              editorState.doc
            )
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
