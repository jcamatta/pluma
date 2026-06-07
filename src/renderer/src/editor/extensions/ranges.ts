// Tracks agent-addressable text ranges in the document. Each range keeps a short sequential id
// (r_1, r_2, …) the agent echoes back; ids are minted inside the plugin state, never from a
// module-level counter. A range reports drift when the text under it no longer matches the original.

import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'

type RangeStatus = 'ok' | 'error'

type TrackedRange = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly originalText: string
  readonly currentText: string
  readonly status: RangeStatus
  readonly error: string | null
}

type SetRangeInput = {
  readonly editor: Editor
  readonly range: Pick<TrackedRange, 'from' | 'to' | 'originalText'>
}

type DelRangeInput = {
  readonly editor: Editor
  readonly id: string
}

type GetRangeInput = {
  readonly editor: Editor
  readonly id: string
}

type StoredRange = Omit<TrackedRange, 'currentText' | 'status' | 'error'>

type RangesState = {
  readonly ranges: readonly TrackedRange[]
  readonly nextId: number
}

type RangeAddRequestEvent = {
  readonly type: 'range_add_request'
  readonly range: Pick<TrackedRange, 'from' | 'to' | 'originalText'>
}

type RangeRemovedEvent = {
  readonly type: 'range_removed'
  readonly id: string
}

type RangeEvent = RangeAddRequestEvent | RangeRemovedEvent

const rangesPluginKey = new PluginKey<RangesState>('ranges')

const emptyState: RangesState = { ranges: [], nextId: 1 }

function getState(editor: Editor): RangesState {
  return rangesPluginKey.getState(editor.state) ?? emptyState
}

function getRange({ editor, id }: GetRangeInput): TrackedRange | null {
  return getState(editor).ranges.find((range) => range.id === id) ?? null
}

function setRange({ editor, range }: SetRangeInput): TrackedRange {
  const idBefore = getState(editor).nextId

  editor.view.dispatch(
    editor.state.tr.setMeta(rangesPluginKey, {
      range,
      type: 'range_add_request'
    } satisfies RangeEvent)
  )

  const created = getState(editor).ranges.find((candidate) => candidate.id === `r_${idBefore}`)
  return created ?? hydrateRange({ ...range, id: `r_${idBefore}` }, editor.state.doc)
}

function delRange({ editor, id }: DelRangeInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(rangesPluginKey, { id, type: 'range_removed' } satisfies RangeEvent)
  )
}

function hydrateRange(range: StoredRange, doc: ProseMirrorNode): TrackedRange {
  const currentText = doc.textBetween(range.from, range.to, '\n')
  const isCurrent = currentText === range.originalText

  return {
    ...range,
    currentText,
    error: isCurrent ? null : 'Range text no longer matches the original text.',
    status: isCurrent ? 'ok' : 'error'
  }
}

function mapRange(range: TrackedRange, transaction: Transaction): TrackedRange {
  return hydrateRange(
    {
      id: range.id,
      from: transaction.mapping.map(range.from, 1),
      to: transaction.mapping.map(range.to, -1),
      originalText: range.originalText
    },
    transaction.doc
  )
}

function isRangeEvent(value: unknown): value is RangeEvent {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const { type } = value
  return type === 'range_add_request' || type === 'range_removed'
}

function readRangeEvent(transaction: Transaction): RangeEvent | null {
  const meta: unknown = transaction.getMeta(rangesPluginKey)
  return isRangeEvent(meta) ? meta : null
}

function applyRangeEvent(
  state: RangesState,
  context: { readonly event: RangeEvent; readonly doc: ProseMirrorNode }
): RangesState {
  const { event, doc } = context

  if (event.type === 'range_removed') {
    return { ...state, ranges: state.ranges.filter((range) => range.id !== event.id) }
  }

  return {
    nextId: state.nextId + 1,
    ranges: [
      ...state.ranges.filter((range) => !isSameRangeContent(range, event.range)),
      hydrateRange({ ...event.range, id: `r_${state.nextId}` }, doc)
    ]
  }
}

function isSameRangeContent(
  first: Pick<TrackedRange, 'from' | 'to' | 'originalText'>,
  second: Pick<TrackedRange, 'from' | 'to' | 'originalText'>
): boolean {
  return (
    first.from === second.from &&
    first.to === second.to &&
    first.originalText === second.originalText
  )
}

const RangesExtension = Extension.create({
  name: 'ranges',

  addProseMirrorPlugins() {
    return [
      new Plugin<RangesState>({
        key: rangesPluginKey,

        state: {
          init() {
            return emptyState
          },

          apply(transaction, state) {
            const mapped: RangesState = {
              ...state,
              ranges: state.ranges.map((range) => mapRange(range, transaction))
            }
            const event = readRangeEvent(transaction)
            return event ? applyRangeEvent(mapped, { event, doc: transaction.doc }) : mapped
          }
        }
      })
    ]
  }
})

export { RangesExtension, rangesPluginKey, getRange, setRange, delRange }
export type { RangeStatus, TrackedRange, SetRangeInput, DelRangeInput, GetRangeInput }
