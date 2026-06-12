# Artifacts follow-ups: active-document awareness + deactivate-on-leave

Two small follow-ups surfaced while testing the file-scoped-artifacts work. They land on the same
branch (`feat/editor-per-file`) and the same PR, on top of the editor-per-file architecture.

## What "done" looks like

1. **The agent recovers when the active document changed under it.** The editor tools always act on
   whichever file is active at call time; the agent now knows this can happen and re-orients (re-reads
   the document) instead of blindly retrying a `get_ranges` that fails because the user switched files.
2. **Leaving a file deactivates its active artifact.** Switching to another file clears the active
   annotation/proposal on the file being left, so returning to it and clicking a card re-activates in a
   single click (today it takes two: one to clear the stale active state, one to re-activate).

## Steps

- [x] **Step 1 (backend) — system-prompt: active document can change.** Add a short paragraph to
      `agent-system-prompt.ts` stating the tools act on the _currently active_ document, the active
      document can change between turns, so re-establish it with `get_current_document` /
      `get_current_selection` at the start of work, treat a `get_ranges` `not_found` as a signal the
      document may have changed (re-read before retrying), and never reuse a range id across turns. Assert
      the new guidance in `agent-system-prompt.test.ts`.

- [x] **Step 2 (renderer) — deactivate the artifact on the file you leave.** In
      `ArtifactsPanel.controller.tsx`, when `activePath` changes, clear the active annotation and proposal
      on every open editor whose path is not the active one. Holds the invariant "only the visible file may
      hold an active artifact." Composes with cross-file select (we activate the target editor, then
      `open()` it, so the effect clears the file left behind, not the one just activated). Cover it in the
      controller test: activate an artifact on file A, switch to B, switch back to A, assert A's artifact is
      no longer active.

- [ ] **Step 3 (e2e) — single click re-activates after a round trip.** Extend `artifacts.e2e.ts`: after
      leaving the manuscript for the second file and coming back through the card, assert the highlight is
      active again after a **single** click (the deactivate-on-leave guarantee).

## Deferred — path-addressable tools (belongs to the tabs / multi-file plan)

The robust long-term answer to "the active file may change while the agent is thinking" is to bind each
tool to an explicit file identity instead of "whatever is active now": the agent passes a path, the
editor registry resolves it to its mounted editor, an unknown/closed path returns a typed error, and a
rename re-keys the registry. That also unlocks acting on any _open_ file (not just the active one), and
later a backend `fs.readFile` tool for files that are not open. Not built here: pre-tabs there is no UI
to aim the agent at a non-active file, and rename does not exist yet, so it would be speculative
capability. Captured so the tabs plan owns it.
