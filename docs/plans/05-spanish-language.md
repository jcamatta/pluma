# 05 — Spanish (Latin America) language support

## Goal

Let the user switch Pluma's interface between English and Spanish. Spanish is **scoped to Latin American Spanish** (neutral LatAm register), selectable from Settings, and persisted across reloads.

"Done" looks like:

- A `es.json` locale with full parity to `en.json`, written in neutral Latin American Spanish.
- The user can pick the language in Settings (next to Appearance); the whole UI switches immediately.
- The choice survives a reload (localStorage, same mechanism as theme) and is applied before first paint (no English flash).
- All checks green (`lint`, `test`, `type-coverage`, `build`) plus `test:e2e` for the UI change.

## Constraints & decisions

- **Renderer-only, no backend.** Language is a pure UI preference, exactly like theme. It is stored in `localStorage` (`pluma.language`) and applied via `i18n.changeLanguage`. No use case, no port, no IPC, no `Result` — those layers don't apply to a renderer-local preference. (The theme setting set this precedent.)
- **Locale key = `es`**, label **"Español"**. Content is written in **neutral Latin American Spanish**: use "tú" (no voseo), avoid Peninsular "vosotros", prefer LatAm vocabulary ("computadora", "celular", "carpeta", "archivo"), and Spanish punctuation (`¿ … ?`, `¡ … !`). Mirror the app's curly typography (`’ ‘ … —`).
  - _Open question for review:_ use plain `es`, or `es-419` (UN code for Latin American Spanish)? `es` is simplest and works fine for `Intl`/`changeLanguage`; `es-419` is more explicit. **Recommendation: `es`.**
- **Translation is done by a dedicated translation agent** (see Step 1), not hand-typed inline, with explicit LatAm guidelines. Hard requirements for the translation: keep every key exactly, preserve interpolation placeholders (`{{name}}`, `{{count}}`, `{{tool}}`, `{{message}}`, `{{level}}`, `{{title}}`), keep the i18next plural keys (`rail.step_one` / `rail.step_other` — Spanish uses the same one/other categories as English), and preserve `\n` newlines.
- **No new dependencies** — `i18next`/`react-i18next` are already installed.
- Reuse the existing segmented control by generalizing it; **no `as` casts** — guard the radio value with a typed predicate prop (the same pattern `isTheme` already uses).

## Steps

Each step is one mini-commit, independently green, within the commit-size budget. `.json` under `src/` carries weight; the parity test in Step 1 satisfies the "needs a test" rule for the locale file.

### Step 1 — Spanish locale file + parity test ✅ done

_Landed: `es.json` (neutral LatAm Spanish, via a dedicated Opus translation agent following the glossary above) and `locales/__tests__/locale-parity.test.ts`, which asserts es↔en key parity AND matching `{{…}}` placeholders per key. No wiring yet; app behavior unchanged. Test green._

- Add `src/renderer/src/i18n/locales/es.json` — full translation of `en.json` into neutral Latin American Spanish.
  - **Execution:** run a dedicated translation agent (Opus) given `en.json` and the LatAm guidelines above; it returns the complete `es.json`. Review the output for placeholder/plural/newline integrity before committing.
- Add `src/renderer/src/i18n/locales/__tests__/locale-parity.test.ts` — a pure test asserting `es.json` has the **same set of (deep) keys** as `en.json` (no missing keys, no extras). This is genuinely useful (guards future drift) and satisfies the commit-size "needs a test" rule for the JSON addition.
- No wiring yet → app behavior unchanged; commit is self-contained and green.
- _Budget:_ `es.json` ≈ 123 weighted lines; the parity test is weight 0. One source file + one test file.

### Step 2 — Language persistence + i18n registration ✅ done

_Landed: `settings.ts` gained `Language`, `isLanguage`, `loadLanguage`, `saveLanguage` (localStorage `pluma.language`, default `en`, framework-free). `i18n/index.ts` now registers the `es` resource and seeds `lng: loadLanguage()` (fallback `en`) so the stored language applies before first paint. Tests added to `settings/__tests__/settings.test.ts`. Green._

- `src/renderer/src/settings/settings.ts`: add, alongside the theme helpers, `type Language = 'en' | 'es'`, `LANGUAGE_KEY = 'pluma.language'`, `isLanguage` (typed guard), `loadLanguage()` (localStorage → default `'en'`), `saveLanguage()` (localStorage write). Keep it framework-free (no React, no i18n import) so it can run at startup.
- `src/renderer/src/i18n/index.ts`: register the `es` resource and set `lng: loadLanguage()` (keep `fallbackLng: 'en'`). This applies the persisted language before first paint, with no English flash — mirroring how `initSettings()` applies the theme.
- Tests: extend the settings logic test (or add `settings/__tests__/settings.test.ts` if none) to cover `loadLanguage` default + round-trip and `isLanguage` guard.
- _Budget:_ ~20 weighted src lines + test.

### Step 3 — Expose language in the settings hook ✅ done

_Landed: `Settings`/`loadSettings` now carry `language` (seeded via `loadLanguage`); `useSettings` exposes `language` + `setLanguage`, which persists and calls `i18n.changeLanguage`. Added `useSettings.test.ts`; updated the theme tests' exact-shape assertions to include `language: 'en'`. Green._

- `src/renderer/src/settings/useSettings.ts`: add `language: Language` to `UseSettings`, seed it from `loadSettings`/`loadLanguage`, and add `setLanguage(language)` that calls `saveLanguage(language)` **and** `i18n.changeLanguage(language)`, then mirrors it into local state so controls re-render. (`i18n.changeLanguage` is the language equivalent of `applyTheme` — the action lives in the hook, the persistence stays pure in `settings.ts`.)
- `loadSettings()` in `settings.ts` returns `{ theme, language }` so the shell seeds both from one read.
- Test: add `settings/__tests__/useSettings.test.ts` (`renderHook`) asserting `setLanguage('es')` persists to localStorage and flips `i18n.language` to `es`.
- _Budget:_ small; hook + one test file.

### Step 4 — Language field in the Settings dialog ✅ done

_Landed: `SegmentedField` generalized to `SegmentedField<T extends string>` with an `isValid` guard prop (no `as`); theme field passes `isTheme`, new Language field passes `isLanguage`. Added `settings.language.*` to `en.json` and `es.json`. Updated `SettingsDialog.test.tsx` (new props + language-field assertions). 18 settings/i18n tests green; eslint clean (0 errors)._

- Generalize `SegmentedField` in `SettingsDialog.tsx` to a generic string-valued control (`value`, `options`, `onValueChange`, plus an `isValid: (v: string) => v is T` guard prop) so it serves both Theme and Language without an `as` cast. The existing theme field passes `isTheme`; the new language field passes `isLanguage`.
- Add a **Language** `Field` (segmented: English / Español) wired to `settings.language` / `settings.setLanguage`.
- Add the strings to **both** `en.json` and `es.json` under `settings.language`: `title`, `description`, `en` ("English"), `es` ("Español").
- Update `settings/__tests__/SettingsDialog.test.tsx` to assert the Language field renders and selecting "Español" calls `setLanguage('es')`.
- _Budget:_ within limits (one component file refactor + two small JSON edits + test); well under 15 files.

### Step 5 — e2e: switch language in the real app ✅ done

_Landed: a second test in `e2e/settings.e2e.ts` opens Settings, picks "Español", asserts the dialog title switches to "Configuración" and `localStorage 'pluma.language' === 'es'`, then reverts to English (the userData store is shared across specs, so the test leaves it clean). Same `@e2e feature:settings` claim — no manifest change. `playwright test settings.e2e.ts` → 2 passed._

- Extend `e2e/settings.e2e.ts` (same `@e2e feature:settings` claim — **no manifest change**, no new IPC channel): open Settings, click "Español", and assert a known UI string switched to Spanish (e.g. the Settings dialog title) and/or `localStorage 'pluma.language' === 'es'`. Keep the existing theme assertion intact.
- Run `npm run test:e2e` and report green.

### Step 6 — Remove this plan (docs commit)

- When Steps 1–5 are shipped and green, delete this file in its own `docs:` commit ("remove plan 05, complete").

## Verification

- `npm run lint && npm run test && npm run type-coverage && npm run build` green.
- `npm run test:e2e` green (UI change).
- Manual: toggle Settings → Language → Español; confirm the explorer, editor empty state, settings, and chat rail labels all switch; reload the app and confirm Spanish persists with no English flash.

## Confirmed glossary (hand this to the translation agent verbatim)

Decisions from review:

- **Full UI translation.** Only brand/product names stay English: **Pluma** (app name), **Opus 4.8**, **Sonnet 4.6** (model names).
- **Locale key `es`**, label "Español". Segmented toggle (matches theme).
- **"Chats" kept** as a loanword (do not translate to "Conversaciones").
- **The "artifact" concept → "sugerencia"** (not "artefacto"). E.g. `artifacts.empty` → "Aún no hay sugerencias…", `artifacts.proposedRewrite` → "Reescritura propuesta".

Editor / slash-menu terms (Google Docs + Word + Notion Spanish conventions):

| English                           | Spanish                                 |
| --------------------------------- | --------------------------------------- |
| Basic blocks                      | Bloques básicos                         |
| Text                              | Texto                                   |
| Heading {{level}} / Heading 1·2·3 | Encabezado {{level}} / Encabezado 1·2·3 |
| Bulleted list                     | Lista con viñetas                       |
| Numbered list                     | Lista numerada                          |
| Quote                             | Cita                                    |
| Code                              | Código                                  |
| Divider                           | Divisor                                 |
| Untitled                          | Sin título                              |
| Settings                          | Configuración                           |

Panels: Chats → **Chats**; Review → **Revisión**; artifacts → **sugerencias**.

Resolved questions: locale key = `es`; product/model names stay English; control = segmented toggle.
