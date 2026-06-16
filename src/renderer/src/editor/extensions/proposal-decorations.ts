// Builds the decorations for a proposal: a block/span-level red-green preview for a ready proposal —
// the replaced span struck/red and the new content rendered formatted/green in a widget — or a single
// conflicted mark when its underlying text drifted. The active proposal additionally gets a 2px accent
// ring (the `proposal-active` class, styled in App.css) and a floating accept/reject pill widget.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { Check, X } from 'lucide-react'
import { DOMSerializer, type Schema } from '@tiptap/pm/model'
import { Decoration } from '@tiptap/pm/view'
import type { Proposal } from './proposals'

// The pill's translated labels, resolved by the caller (the proposals plugin reads the i18n singleton
// the same way placeholder.ts does, since this runs outside React).
type PillLabels = {
  readonly rewrite: string
  readonly insert: string
  readonly accept: string
  readonly reject: string
  readonly conflicted: string
}

// The accept/reject/toggle actions are passed in (bound to this proposal by the plugin) rather than
// imported, so the command logic stays single-sourced in proposals.ts and this module avoids a runtime
// import cycle with it.
type ProposalActions = {
  readonly onAccept: () => void
  readonly onReject: () => void
  readonly onToggleActive: () => void
}

type ProposalDecorationsInput = {
  readonly proposal: Proposal
  readonly schema: Schema
  readonly active: boolean
  readonly labels: PillLabels
  readonly actions: ProposalActions
}

// lucide icons rendered to static SVG markup once at module load — no live React tree mounts inside the
// imperative widget DOM, and no SVG paths are hand-drawn (the markup comes straight from lucide-react).
const checkSvg = renderToStaticMarkup(createElement(Check, { size: 15 }))
const xSvg = renderToStaticMarkup(createElement(X, { size: 15 }))

// Renders the proposal's parsed content (a `{ type: 'doc', content: [...] }` JSON) to real formatted
// DOM via the editor schema, so the preview shows actual headings/lists/paragraphs rather than the
// raw markdown source.
function draftElement(input: ProposalDecorationsInput, embedPill: boolean): HTMLElement {
  const { proposal, schema, active, actions } = input
  const node = schema.nodeFromJSON(proposal.content)
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(node.content)
  const element = document.createElement('div')
  element.className = withActive('proposal-draft', active)
  // Clicking the green preview toggles this proposal's activation; the struck red span of a replace is
  // covered by the plugin's handleClickOn, but a pure insert has no doc range to click, so the widget
  // itself carries the toggle.
  element.addEventListener('mousedown', (event) => {
    event.preventDefault()
    actions.onToggleActive()
  })
  // A pure insert has no struck span to float a pill over, so its accept/reject pill rides inside the
  // block as an absolute overlay — it sits above the block without displacing the document below it.
  if (embedPill) element.appendChild(pillElement(input, true))
  element.appendChild(fragment)
  return element
}

// The key lets ProseMirror reuse the widget's DOM node across unrelated transactions instead of
// destroying and recreating it on every state change — without it the node remounts each transaction
// and replays its entry animation, which reads as a flicker. The proposal id is stable across edits
// (the widget's mapped position is not, so it must not feed the key).
function draftDecoration(input: ProposalDecorationsInput, embedPill: boolean): Decoration {
  const { proposal, active } = input
  // The active flag is folded into the key so toggling active rebuilds the widget DOM (otherwise
  // ProseMirror reuses the cached node and neither the proposal-active class nor the embedded insert
  // pill — which both follow the active state — would land on it).
  return Decoration.widget(proposal.to, () => draftElement(input, embedPill), {
    side: 1,
    key: active ? `${proposal.id}:active` : proposal.id
  })
}

type IconButtonInput = {
  readonly className: string
  readonly label: string
  readonly svg: string
  readonly onClick: () => void
}

function iconButton({ className, label, svg, onClick }: IconButtonInput): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = svg
  // Stop the click from reaching the document, which would otherwise toggle the proposal off before the
  // accept/reject runs.
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

function spanWithClass(className: string, text?: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = className
  if (text !== undefined) span.textContent = text
  return span
}

// The accept/reject controls plus their divider, shown only on a ready proposal (a conflicted one can no
// longer apply, so it offers none).
function pillActions({ labels, actions }: ProposalDecorationsInput): readonly HTMLElement[] {
  return [
    spanWithClass('suggestion-pill-sep'),
    iconButton({
      className: 'suggestion-pill-accept',
      label: labels.accept,
      svg: checkSvg,
      onClick: actions.onAccept
    }),
    iconButton({
      className: 'suggestion-pill-reject',
      label: labels.reject,
      svg: xSvg,
      onClick: actions.onReject
    })
  ]
}

// Floats above the active suggestion (`bottom: 100%`) and offers accept/reject. A conflicted proposal —
// its underlying text drifted, so it can no longer apply — renders muted with only the conflicted label,
// matching the artifacts surface (no plain Accept affordance). `overlay` marks the wrap as an absolute
// overlay anchor (used when the pill rides inside an insert's draft block rather than the doc flow).
function pillElement(input: ProposalDecorationsInput, overlay = false): HTMLElement {
  const { proposal, labels } = input
  const conflicted = proposal.status === 'conflicted'

  const pill = spanWithClass(conflicted ? 'suggestion-pill conflicted' : 'suggestion-pill')
  const typeLabel = proposal.from === proposal.to ? labels.insert : labels.rewrite
  pill.appendChild(
    spanWithClass('suggestion-pill-label', conflicted ? labels.conflicted : typeLabel)
  )
  if (!conflicted) pillActions(input).forEach((node) => pill.appendChild(node))

  const wrap = spanWithClass(
    overlay ? 'suggestion-pill-wrap suggestion-pill-overlay' : 'suggestion-pill-wrap'
  )
  wrap.appendChild(pill)
  return wrap
}

function pillDecoration(input: ProposalDecorationsInput): Decoration {
  return Decoration.widget(input.proposal.from, () => pillElement(input), {
    side: -1,
    key: `${input.proposal.id}:pill`
  })
}

// Appends the active marker class when this proposal is the cross-type active suggestion; App.css styles
// the accent ring on that class.
function withActive(className: string, active: boolean): string {
  return active ? `${className} proposal-active` : className
}

function proposalDecorations(input: ProposalDecorationsInput): Decoration[] {
  const { proposal, active } = input
  const floatingPill = active ? [pillDecoration(input)] : []

  if (proposal.status === 'conflicted') {
    return [
      Decoration.inline(proposal.from, proposal.to, {
        class: withActive('proposal-conflicted', active)
      }),
      ...floatingPill
    ]
  }

  // A pure insert (`from === to`) replaces nothing and has no inline span to float a pill over, so it
  // shows only the green added preview and embeds its active pill inside that block as an overlay.
  if (proposal.from === proposal.to) {
    return [draftDecoration(input, active)]
  }

  // A replace strikes the removed span red and floats the pill at the span's start.
  return [
    Decoration.inline(proposal.from, proposal.to, {
      class: withActive('proposal-delete', active)
    }),
    ...floatingPill,
    draftDecoration(input, false)
  ]
}

export { proposalDecorations }
export type { ProposalDecorationsInput, PillLabels }
