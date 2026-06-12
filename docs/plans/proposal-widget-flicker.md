# Plan — Proposal insert-widget flicker

Status: **active.** A small, isolated bug fix on its own branch (`fix/proposal-widget-flicker`).

## The bug

When an active proposal contains added text, its green insert decoration (`.proposal-insert`)
appears and disappears on every editor interaction — clicking, typing, selecting. It only affects
the **addition** (green) decoration, not deletions or annotations.

## Root cause

The addition is a `Decoration.widget` built fresh inside `proposalDecorations`
([proposal-decorations.ts](../../src/renderer/src/editor/extensions/proposal-decorations.ts)), and
the proposals plugin's `decorations` prop rebuilds the whole `DecorationSet` on **every
transaction**. The widget carried **no `key` in its spec**, so ProseMirror could not recognize it as
the same widget between transactions — it destroyed the old DOM node and created a new one each time.
The new node re-triggers the `.proposal-insert { animation: accept-in }` entry animation
(`App.css`), which is the visible flicker. Deletions/annotations are _inline_ decorations (compared
by range + attrs), so they don't remount — matching the "only the added text" symptom.

## Done looks like

The green insert decoration is drawn once and stays put while the user clicks, types, and selects
around the document; its entry animation plays only when the proposal is first activated.

## Steps

1. **Fix + test (one commit).** Give the insert widget a stable `key` derived from the proposal id
   and the insert's offset within the original text — both invariant across edits (the widget's
   _mapped position_ is not, so it must not feed the key). Add a regression test that activates a
   proposal with an addition, captures the `.proposal-insert` DOM node, dispatches an unrelated
   transaction, and asserts the **same** node persists. — **DONE.** `key: \`${proposal.id}:${offset}\``on the widget spec;`insertDecoration`takes a single`{ from, value, key }`arg to stay within`max-params`. Test `proposal-decorations.test.ts` proves node identity survives a no-op
   transaction (and fails without the key).

2. **Close out.** Run the checks, prove it in the real app, remove this plan, open the PR.
