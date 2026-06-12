# Plan — Chat rail fixes & improvements

Status: **active.** A batch of small, independent fixes to the right-hand conversation rail
(`src/renderer/src/rail/`), each a polish issue surfaced from real use. None adds an IPC channel
or a use case — this is renderer-only work over existing pure views and one controller. One branch,
several mini-commits, ordered trivial → involved so each lands green on its own.

The five issues:

1. **Composer wheel scroll.** Once the textarea text passes the composer's max height (`max-h-40`)
   it stops growing, but the mouse wheel can no longer scroll the overflowed text.
2. **Assistant markdown.** Assistant replies show raw markup (`*word*`) instead of rendered
   emphasis. There is no markdown renderer; replies are printed as plain text. User messages stay
   plain.
3. **The step-count dot.** The activity header reads `Worked · 3 steps` — remove the `·`.
4. **Collapse while working.** The activity ("steps") panel can only be collapsed after the run
   settles; while working the toggle is disabled. It should collapse/expand at any time.
5. **Scroll to the sent message.** Sending a message does not move the view to it — the user
   scrolls by hand. On a **user** message (not assistant streaming) the conversation should scroll
   the new message into view.

---

## 0. What "done" looks like

`npm run lint && npm run test && npm run type-coverage && npm run build` green, plus
`npm run test:e2e` green (UI work). Then, manual `npm run dev`:

1. Type a multi-line prompt past the composer's max height → the wheel scrolls the text inside the
   composer.
2. The assistant's reply renders markdown — `**bold**`, `*italic*`, inline `code`, lists, headings,
   links — with our tokens. The user's own bubbles stay plain text.
3. The activity header reads `Worked  3 steps` (no dot).
4. The chevron is live while the agent works: the steps panel can be collapsed and re-expanded
   mid-run.
5. Sending a message scrolls the conversation so the just-sent user message is in view; the
   assistant streaming below does not yank the scroll.

---

## 1. Steps (each one mini-commit, each green)

Ordered so the trivial, isolated view edits land first and the dependency decision (markdown) is
last. Steps 1–4 are independent of each other.

### Step 1 — `fix(rail): drop the dot before the step count`

- **`src/renderer/src/rail/Activity.view.tsx`** — in `Header`, change `· {stepLabel}` to
  `{stepLabel}`. (Issue 3.)
- **`src/renderer/src/rail/__tests__/Activity.view.test.tsx`** — update/confirm the header assertion
  so it matches the dot-free label (and guards against the dot returning).

Delivers: clean `Worked  3 steps` header. Tiny diff; test lands with it.

### Step 2 — `fix(rail): allow collapsing the activity panel while working`

- **`src/renderer/src/rail/Activity.view.tsx`** — in `Header`, remove `disabled={working}` and the
  `{!working && …}` guard so the chevron always renders and the toggle fires during a run. The
  rotation already keys off `expanded`. (Issue 4.)
- **`src/renderer/src/rail/__tests__/Activity.view.test.tsx`** — assert the toggle is enabled and the
  chevron is present when `working` is true, and that `onToggleExpand` fires.

Delivers: the steps timeline collapses/expands at any time. The controller's `expandOverride` already
supports a mid-run toggle (`expanded={expandOverride ?? working}`), so no controller change is needed.

### Step 3 — `fix(rail): scroll the composer text with the mouse wheel`

Keep `Scrollable` (Base UI `ScrollArea` only — never a native overflow scroll). Match the worked
reference in `.references/serene/.../ai-chat/Composer.tsx`: it wraps an `overflow-hidden` textarea in
`Scrollable className="max-h-40"` and **auto-grows the textarea height in JS** (a `useLayoutEffect`
that sets `height = 'auto'` then `height = scrollHeight + 'px'` on each `value` change) instead of
CSS `field-sizing-content`. The JS-driven explicit height is what lets the `ScrollArea` viewport
detect the overflow and own the wheel; `field-sizing-content` is why our wheel scroll fails. (Issue 1.)

- **`src/renderer/src/rail/ComposerField.tsx`** (new, plain component) — owns the textarea, its ref,
  and the auto-grow `useLayoutEffect`, wrapped in `Scrollable className="max-h-40"`. Takes
  `value` / `onChange` / `onKeyDown` / `placeholder` as props. (Placed here, not in `RailComposer.view`,
  because the view must stay pure — no hooks/refs; a plain component may hold this local DOM behavior.)
- **`src/renderer/src/rail/RailComposer.view.tsx`** — render `<ComposerField …/>` in place of the
  inline `Scrollable` + `field-sizing-content` textarea; the Send/Stop slot and `⌘↵` hint stay.
- **`src/renderer/src/rail/__tests__/ComposerField.test.tsx`** (new) — render it, assert typing fires
  `onChange`, `⌘/Ctrl+↵`-style key handling still reaches `onKeyDown`, and the textarea keeps
  `overflow-hidden` inside a `Scrollable` (regression guard against the wheel break). Wheel physics
  itself is browser behavior, covered by the e2e step.

Delivers: a long prompt scrolls inside the composer via the wheel, with the Base UI scrollbar intact.

### Step 4 — `feat(rail): scroll a sent message into view`

- **`src/renderer/src/rail/ChatRail.controller.tsx`** — add a ref for the current turn's user
  message and an effect that scrolls it into view when the latest user prompt changes (keyed on
  `currentPrompt`, which only changes on a new **user** turn — assistant deltas update `activity`,
  not `currentPrompt`, so streaming never triggers a scroll). Scroll the message to the **bottom** of
  the viewport (`scrollIntoView({ block: 'end' })`) so it's the focus, with a small spacer below the
  current turn (see next file) leaving breathing room for the assistant reply to appear beneath it.
  The scroll call is a thin action; no business logic to extract.
- **`src/renderer/src/rail/ConversationTurn.view.tsx`** — accept an optional `ref` (forwarded to the
  turn's `UserMessage` wrapper) so the controller can target it, and render a small fixed-height
  spacer below the turn so the just-sent message isn't flush against the composer and the streaming
  reply has visible room. Pure props, no hooks; spacer height from the Tailwind scale (a token-backed
  step, no arbitrary value). (Q3.)
- **`src/renderer/src/rail/__tests__/ConversationRail.controller.test.tsx`** — assert
  `scrollIntoView` is called when a turn is submitted / `currentPrompt` appears, and is **not** called
  on an assistant-only `activity` update (the user-message-only requirement).

Delivers: the conversation scrolls down to the message you just sent, with a gap beneath it where the
assistant's reply streams in; assistant streaming alone never steals the scroll. (Issue 5.)

### Step 5 — `feat(rail): render assistant replies as markdown`

Uses **`react-markdown` + `remark-gfm`** (approved — see Q1). Two render sites consume one shared
renderer; user messages are untouched.

- **Add the dependencies** — `react-markdown` and `remark-gfm` to `package.json`. (Per the
  worktree/shared-`node_modules` note, make sure the manifest + lockfile changes land on this branch.)
- **`src/renderer/src/rail/AssistantMarkdown.view.tsx`** (new) — a pure view wrapping `ReactMarkdown`
  with `remarkPlugins={[remarkGfm]}` and a `components` map that styles each element with **our tokens
  and the Tailwind scale only** (e.g. `strong` → `font-semibold`, `em` → `italic`, inline `code` →
  `font-editor bg-surface-2` rounded, `a` → `text-action-primary`, `ul`/`ol`/`li`, `h1–h3`,
  `p` spacing). No arbitrary/`[...]` values, no hardcoded colors. Links open safely.
- **`src/renderer/src/rail/Transcript.view.tsx`** — `AssistantReply` renders `<AssistantMarkdown>`
  instead of `{text}`.
- **`src/renderer/src/rail/AssistantTurn.view.tsx`** — the live `reply` renders `<AssistantMarkdown>`
  instead of `{reply}`.
- **Tests** — `src/renderer/src/rail/__tests__/AssistantMarkdown.view.test.tsx` (new) covering bold,
  italic, inline code, link, list, heading, and plain-text passthrough (assert real marks, e.g. a
  `<strong>` for `**x**`); update `Transcript.view.test.tsx` / `AssistantTurn.view.test.tsx` to assert
  rendered marks rather than raw asterisks.

If the dependency add + renderer + two wirings + tests exceed the commit budget, split into two
commits (renderer + tests, then the two view wirings). Delivers: assistant replies show real
emphasis/structure; raw `*word*` is gone. User bubbles stay plain text.

### Step 6 — `test(e2e): cover the rail polish in the real app`

- **`e2e/rail.e2e.ts`** — extend the existing rail spec(s): assert the activity panel can be
  collapsed **while a run is in flight** (Issue 4), that an assistant reply containing markdown
  renders a mark rather than raw asterisks (Issue 2), and that the composer/scroll behaviors hold.
  No new manifest ids — `feature:rail` and its operations already exist, and no IPC channel is added.

Delivers: the changes are exercised against the built app. `e2e/` is weight 0.

### Step 7 — `docs: remove plan chat-rail-fixes, complete`

- Delete **`docs/plans/chat-rail-fixes.md`** as its own `docs:` commit once every step has shipped
  and all checks are green (performed by `finish-plan`).

---

## 2. Constraints

- **Renderer-only, no new layers.** No IPC channel, no use case, no port — these are view/controller
  edits over the existing rail. The e2e manifest is untouched (no new feature/operation id).
- **Component-type rules.** `*.view.tsx` stay pure (props only, no hooks beyond render, no
  `window.api`); the scroll effect and refs live in `ChatRail.controller.tsx`. A `ref` prop on a view
  is allowed (it is not a hook).
- **Design tokens + Base UI + Motion + `t()`.** The markdown renderer uses only our tokens and the
  Tailwind scale (no arbitrary/`[...]` values); any new interactive element uses Base UI; user-facing
  strings stay translated. No hardcoded colors.
- **No escape hatches.** Parse/branch without `as` (except `as const`) or `!`; if the markdown
  library's types need narrowing, write a guard, don't cast.
- **Dependencies:** `react-markdown` + `remark-gfm` are approved (Q1) and added in Step 5; no others.
- **Definition of done includes `npm run test:e2e`** for this UI work.

---

## 3. Open questions

- [x] **Q1 — Markdown renderer (Step 5): SETTLED.** Approved adding **`react-markdown` + `remark-gfm`**.
- [x] **Q2 — Composer scroll (Step 3): SETTLED.** Keep `Scrollable` (Base UI `ScrollArea` only);
      adopt serene's JS auto-grow pattern instead of `field-sizing-content`.
- [x] **Q3 — Where the sent message lands (Step 4 / Issue 5): SETTLED.** Scroll the new user message
      to the **bottom** of the viewport (`scrollIntoView({ block: 'end' })`), with a small spacer below
      the current turn so it's not flush against the composer and the assistant's reply has visible
      breathing room to appear beneath it.
