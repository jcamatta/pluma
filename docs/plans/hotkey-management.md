# Plan: Central hotkey registry — one declarative source for keyboard shortcuts

## What & why

Keyboard shortcuts are spreading across the renderer as ad-hoc `window.addEventListener('keydown')`
hooks and inline `onKeyDown` branches, with no single place to see them all and nothing that catches
two features binding the same chord. As more land (Ctrl+Tab tab switching, Enter-to-send), this gets
unmanageable.

Introduce ONE renderer-level hotkey **registry** (a context, mirroring the existing frontend-tool
registry in `src/renderer/src/agent/`): features register a declarative binding `{ id, combo, when?,
run }` for the lifetime of the component that owns it; a single window-level listener matches the
pressed key against the registry and dispatches. The registry detects **combo conflicts** (two enabled
bindings claiming the same chord) and exposes a **snapshot** so a future "keyboard shortcuts" surface
can list them all. Migrate today's global, app-level shortcuts onto it **incrementally and behavior-
preservingly**, one per step.

This is a **refactor/consolidation**, not a behavior change. Each migration step must leave the app
behaving identically; new shortcuts (Ctrl+Tab, Enter-to-send) are noted as future registrants, not
built here.

## Inventory — where keyboard handling lives TODAY (the thing being consolidated)

**Global / app-level (in scope to migrate):**

- **Editor zoom — wheel + main-process accelerators.**
  - `src/renderer/src/editor/useEditorZoom.ts` — binds `ctrl/cmd + wheel` on the editor container to
    zoom in fixed steps (a `wheel` listener, NOT keydown). Pure math in
    `src/renderer/src/editor/editor-zoom-logic.ts`. Consumed in
    `src/renderer/src/editor/Editor.controller.tsx` (`const { containerRef, zoom } = useEditorZoom()`).
    This is a wheel gesture, not a key chord — see Open question Q3 on whether it belongs in the registry.
  - `src/main/index.ts:68-70` — `optimizer.watchWindowShortcuts(window, { zoom: true })`; the
    `{ zoom: true }` flag is what lets Ctrl/Cmd +/-/0 reach the View-menu zoom accelerators instead of
    being swallowed.
  - `src/main/menu.ts` — the View submenu supplies the `resetZoom` / `zoomIn` / `zoomOut` roles
    (Ctrl/Cmd +/-/0). These are **Electron accelerators in the MAIN process**, not renderer keydown.

- **Chat focus toggle — Ctrl/Cmd+K (window keydown).**
  - `src/renderer/src/rail/useChatShortcut.ts` — `window.addEventListener('keydown')`; on Ctrl/Cmd+K
    opens the rail + focuses the composer, or returns focus to the editor if the composer already has it.
    `isChatShortcut(event)` is the matcher.
  - `src/renderer/src/rail/ChatShortcutBridge.tsx` — mounts the hook inside the editor + composer focus
    providers, wiring `openRail`, `composer.isFocused`, `composer.focus`, `editor.commands.focus`. Mounted
    in `src/renderer/src/App.tsx:52`.

- **Composer send — Ctrl/Cmd+Enter (inline onKeyDown).**
  - `src/renderer/src/rail/RailComposer.view.tsx:53-58` — inline `onKeyDown`: `(meta||ctrl)+Enter` and
    `!working` → `onSubmit()`. Passed down to the textarea via
    `src/renderer/src/rail/ComposerField.tsx` (`onKeyDown` prop). This is the seam the planned
    **Enter-to-send** feature will change; migrating it onto the registry is the cleanest host for that
    later toggle.

**Local / component-scoped editing keys (NOT global shortcuts — explicitly OUT of scope; see Constraints):**

- `src/renderer/src/editor/extensions/slash-command.ts` — ArrowUp/Down/Enter/Escape forwarded to the
  slash menu while it is open (a TipTap suggestion plugin, editor-internal).
- `src/renderer/src/explorer/NameInput.tsx`, `src/renderer/src/threads/ThreadTitleInput.tsx` —
  Enter commits / Escape cancels an inline rename input (field-local).
- `src/renderer/src/editor/AnnotationCard.controller.tsx:79-84` — Escape closes the open annotation card
  (a `document` keydown scoped to while the card is open).

These are field/widget-local interactions, not app-wide shortcuts; folding them into a global registry
would change their semantics (focus scoping, event ordering). They stay where they are.

**Renderer↔main split (a design point, not code to move):** zoom +/-/0 is owned by the **main
process** (menu accelerators + `watchWindowShortcuts`), because only an Electron menu registers those
roles globally and survives focus changes. The registry is **renderer-only** and does NOT try to absorb
the main-process accelerators — see Open question Q1. The registry's snapshot may _list_ the main-owned
zoom chords as read-only "informational" entries so the future shortcuts surface is complete, without
binding them.

## Anchors — patterns to reuse (don't reinvent)

- **Registry-via-context (the model for this whole plan):**
  `src/renderer/src/agent/AgentToolsContext.ts` (`useCreateToolRegistry` — ref-backed `Map`, stable
  `register`/`unregister`/`snapshot`/`byName`, last-wins on duplicate name, never re-renders consumers),
  `src/renderer/src/agent/AgentToolsProvider.tsx` (thin provider), `src/renderer/src/agent/useFrontendTool.ts`
  (register-on-mount/unregister-on-unmount, latest entry in a ref so inline objects don't churn the effect).
  The hotkey registry mirrors this shape exactly.
- **Imperative-handle-via-context (no DOM reaching):** `src/renderer/src/rail/ComposerFocusContext.ts` +
  `ComposerFocusProvider.tsx`, `src/renderer/src/editor/ActiveEditorContext.ts`. Bindings that need a
  sibling component (focus the composer/editor) read these handles in their `run`, exactly as
  `ChatShortcutBridge` does today — the registry does not reach across the DOM.
- **`invariant`** for "must be used within a provider": `src/renderer/src/../shared/invariant`.
- **Shell wiring point:** `src/renderer/src/App.tsx` (providers nest here; `ChatShortcutBridge`,
  `EditorToolsBridge` mount here). `src/renderer/src/usePanels.ts` supplies `openRail`.
- **i18n:** `src/renderer/src/i18n/locales/en.json` + `es.json` (parity test enforced).

## Scope

- IN: a renderer hotkey registry (context + provider + a `useHotkey` register hook + one window-level
  dispatcher) with combo-conflict detection and a snapshot; migration of the three global shortcuts
  (Ctrl/Cmd+K chat toggle, Ctrl/Cmd+Enter composer send) onto it behavior-preservingly; the
  ctrl+wheel editor zoom decision (Q3). Each migration leaves behavior identical.
- OUT (noted, not built here): Ctrl+Tab tab switching and the Enter-to-send toggle (future features that
  will _register through_ this registry); a user-facing "keyboard shortcuts" settings panel (the snapshot
  enables it, but the UI is its own plan); user-rebindable shortcuts; absorbing the main-process zoom
  accelerators into the renderer; the field-local editing keys listed above.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Hotkey combo model + matcher (pure logic).**
   - `src/renderer/src/hotkeys/hotkey-logic.ts`: a declarative `HotkeyCombo` (e.g.
     `{ key: string; mod?: boolean; shift?: boolean; alt?: boolean }`, `mod` = ctrl-or-cmd to stay
     cross-platform like today's `event.metaKey || event.ctrlKey`), a pure `comboMatches(combo, event)`
     replicating the exact match logic in `isChatShortcut` and the RailComposer inline check, a pure
     `comboKey(combo)` → canonical string for conflict-detection/snapshot, and a pure
     `findConflicts(bindings)` → groups enabled bindings by `comboKey`. No DOM, no React.
   - Test (`__tests__/hotkey-logic.test.ts`): matcher honors mod/shift/alt and is case-insensitive on
     `key`; `comboKey` canonicalizes; `findConflicts` reports two enabled same-combo bindings and ignores
     disabled ones. (Code >30 lines → lands its test.)

2. `[frontend]` **Registry context + provider (no dispatch yet).**
   - `src/renderer/src/hotkeys/HotkeyRegistryContext.ts`: mirror `AgentToolsContext` — a `HotkeyBinding`
     `{ id, combo, enabled?, run, preventDefault? }`, a ref-backed `Map<id, binding>` registry with
     stable `register`/`unregister`/`snapshot()`; `useHotkeyRegistry()` read hook guarded by `invariant`.
   - `src/renderer/src/hotkeys/HotkeyRegistryProvider.tsx`: thin provider (mirror `AgentToolsProvider`).
   - `src/renderer/src/hotkeys/useHotkey.ts`: register-on-mount/unregister-on-unmount keyed by `id`,
     latest binding in a ref (mirror `useFrontendTool`) so inline `run`/`combo` don't churn the effect.
   - Tests (`__tests__/HotkeyRegistry.test.tsx`): register/unregister round-trips; `snapshot` lists
     entries; `useHotkey` unregisters on unmount; duplicate `id` last-wins.

3. `[frontend]` **Window dispatcher + dev conflict surfacing, then mount the provider in the shell.**
   - `src/renderer/src/hotkeys/useHotkeyDispatcher.ts`: ONE `window` `keydown` listener that walks the
     registry snapshot, finds the first enabled binding whose `combo` matches via `comboMatches`, calls
     `preventDefault()` (when the binding asks) and its `run`. This is the single global listener that
     replaces the per-feature ones. Surface `findConflicts` results through an explicit logging path (NOT
     `console`) — reuse the project's logging seam if one exists, else expose conflicts on the snapshot for
     a caller to read; resolve in Q2.
   - `src/renderer/src/hotkeys/HotkeyProvider.tsx` (or fold into the provider from step 2): provider +
     dispatcher in one mountable unit. Mount it in `src/renderer/src/App.tsx` high enough to wrap the
     editor + rail (alongside the existing bridges). No bindings registered yet → behavior unchanged.
   - Tests: dispatcher fires the matching binding's `run` and skips disabled/non-matching ones; respects
     `preventDefault`; only the first match runs (deterministic order).

4. `[frontend]` **Migrate Ctrl/Cmd+K chat focus toggle onto the registry (behavior-preserving).**
   - Rewrite `src/renderer/src/rail/ChatShortcutBridge.tsx` to register a single `useHotkey({ id:
'chat.focusToggle', combo: { key: 'k', mod: true }, preventDefault: true, run })` whose `run` is the
     exact body of today's `useChatShortcut` handler (read `composer.isFocused`, else `openRail()` +
     `requestAnimationFrame(focusComposer)`; if composer focused, `focusEditor()`). It still reads
     `useActiveEditor` + `useComposerFocus` for its handles — no DOM reaching.
   - Delete `src/renderer/src/rail/useChatShortcut.ts` (its window listener is now the central dispatcher)
     and migrate/retire `__tests__/useChatShortcut.test.tsx` into a `ChatShortcutBridge` test that asserts
     the registered binding's `run` toggles focus both directions. Net: same keystroke, same effect, one
     fewer window listener.

5. `[frontend]` **Migrate Ctrl/Cmd+Enter composer send onto the registry (behavior-preserving).**
   - The send chord currently lives in `RailComposer.view.tsx`'s inline `onKeyDown` and only fires while
     the textarea is focused. To preserve that scoping with a global dispatcher, gate the binding with the
     composer-focus handle: register `useHotkey({ id: 'composer.send', combo: { key: 'Enter', mod: true },
enabled: () => composerHasFocus && !working, run: onSubmit })` from a controller that already has
     `onSubmit`/`working`/composer-focus (the rail composer controller — confirm exact file in Q4).
   - Remove the inline `(meta||ctrl)+Enter` branch from `RailComposer.view.tsx` (keep the view pure;
     the chord is no longer a view concern). `ComposerField`'s `onKeyDown` prop stays for any remaining
     field-local needs but no longer carries the send chord. Tests: binding submits only when composer
     focused and not working; the previously-passing send behavior still holds.
   - NOTE: the planned **Enter-to-send** toggle will later flip this binding's `combo` (Enter vs
     Ctrl+Enter) from a setting — this step makes that a one-line registry change. Do NOT build the toggle.

6. `[frontend]` **List the main-owned zoom chords as informational (read-only) registry entries.**
   - So the future shortcuts surface is complete, register Ctrl/Cmd +/-/0 (and document the ctrl+wheel
     zoom) as `enabled: false`, `run: noop` informational bindings (or a dedicated `informational: true`
     flag — decide in Q1) sourced from a small declarative list, so they appear in `snapshot()` without
     the renderer trying to handle them (the main process still owns them via `menu.ts`). Keep `useEditorZoom`'s
     ctrl+wheel exactly as-is unless Q3 says otherwise.
   - Tests: snapshot includes the zoom entries; the dispatcher never fires them (disabled).

7. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship.

## Constraints

- **Behavior-preserving refactor.** Every migration step leaves the app behaving identically — same
  chord, same effect, same scoping (composer-focused gating for send). No new user-visible shortcut is
  added in this plan.
- **Renderer-only registry.** It does NOT absorb the main-process zoom accelerators (`src/main/menu.ts`,
  `watchWindowShortcuts`); those remain main-owned. The registry may only _list_ them informationally.
- **No DOM reaching (lint-enforced `rendererNoDomTreeReaching`).** Bindings that drive a sibling
  component obtain an imperative handle via context (`ComposerFocusContext`, `ActiveEditorContext`) — never
  `querySelector`. The dispatcher's single `window` keydown listener is the only direct DOM touch.
- **Mirror the existing registry shape** (`agent/AgentToolsContext.ts` + `useFrontendTool.ts`): ref-backed
  map, stable context value, register/unregister never re-render, latest-entry-in-a-ref. Don't invent a new
  shape.
- **No new dependency.** Hand-roll the matcher (it's small and already exists inline); do NOT add a
  hotkey library.
- **No escape hatches** (`as` except `as const`, no `@ts-ignore`/`eslint-disable`/non-null `!`); no
  module-level mutable state (ids/registry live in the ref-backed map, not a module global); no `console`
  (conflicts go through an explicit logging path); comments explain _why_.
- **Frontend conventions:** pure matcher in `*-logic.ts`; view/controller split preserved (the send chord
  moves OUT of the pure view); any user-facing string (only if a future surface needs one — none here) in
  both `en.json` + `es.json`. No e2e step: this is a behavior-preserving refactor of existing shortcuts
  already covered by their current specs — verify those stay green rather than adding manifest ids (an
  unclaimed id turns the audit red). Confirm in Q5.

## Open questions

- **Q1 — Main-owned zoom chords: informational entries, or leave out entirely?** (open) Listing
  Ctrl/Cmd +/-/0 as disabled/informational makes the future shortcuts surface complete but adds a
  dead-binding concept. Alternative: keep the registry purely for renderer-handled chords and let the
  shortcuts surface read the zoom chords from a separate static list. Decides step 6's shape.
- **Q2 — Where do detected conflicts surface?** (open) No `console` allowed. Options: throw via
  `invariant` in dev only (too aggressive for last-wins semantics), expose `conflicts()` on the snapshot
  for a dev-only panel to read, or route through whatever logging seam the renderer already has. Confirm
  the project's sanctioned logging path before step 3.
- **Q3 — Does ctrl+wheel editor zoom belong in the registry?** (open) It is a `wheel` gesture, not a key
  chord, and is container-scoped (the editor element), not window-global. Leaning **no** — keep
  `useEditorZoom` as-is and only _document_ it in the informational list (step 6). Confirm so step 6
  doesn't over-reach.
- **Q4 — Exact host for the composer-send binding.** (open) `RailComposer.view.tsx` is a pure view; the
  binding needs `onSubmit` + `working` + composer-focus, which live in the rail composer's controller.
  Confirm the controller file that owns those (the `ConversationRail`/composer controller) so step 5
  registers from the right place without threading new props through the view.
- **Q5 — e2e coverage.** (open) These shortcuts are existing behavior. Confirm there is no manifest id
  already claiming "chat focus toggle" / "composer send" that a refactor would break, and that re-running
  the existing suite (not adding a new id) is the right validation. If a shortcut currently has NO e2e and
  the team wants one captured during consolidation, that becomes its own `[e2e]` step with a manifest id +
  spec in the same commit.
