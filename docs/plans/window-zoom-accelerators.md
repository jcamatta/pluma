# Window zoom accelerators

Wire up the standard zoom keyboard shortcuts (`Ctrl/Cmd` + `=` / `-` / `0`) in the Electron main
process so the writer can scale the whole window up, down, and back to 100% on any OS. Today nothing
handles them: the app installs no application menu, and Electron only registers zoom accelerators
through a menu. We install a per-platform application menu whose job is to carry the zoom roles while
preserving the standard menus each OS expects.

Cross-platform is a first-class requirement (the app ships to Windows, Linux, and macOS), so the menu
adapts per platform:

- **macOS:** `setApplicationMenu` replaces the _entire_ menu and the bar is always visible, so the
  template must include the standard menus — `appMenu` (About/Hide/Quit), `editMenu`
  (Undo/Redo/Cut/Copy/Paste/Select All), the zoom `View` submenu, and `windowMenu`. Omitting
  `editMenu` would regress `Cmd+C/V/X/Z/A` in a writing app.
- **Windows / Linux:** the bar stays hidden (`autoHideMenuBar: true`, revealed by `Alt`), so the
  template is just `editMenu` + the zoom `View` submenu; the accelerators fire while no chrome shows.

The `View` submenu is built from the explicit `resetZoom` / `zoomIn` / `zoomOut` roles — **not** the
full `viewMenu` role, which would also expose "Reload" and "Toggle DevTools" to end users.

## Done

- Pressing `Ctrl` + `=` (and numpad `+`) zooms the window in; `Ctrl` + `-` zooms out; `Ctrl` + `0`
  resets to 100%. On macOS the same with `Cmd`.
- On macOS the standard Edit menu still works (`Cmd+C/V/X/Z/A`) — no regression from installing the
  menu.
- On Windows/Linux no visible menu chrome is added in normal use; the bar stays hidden as before.
- Zoom is per-window and not persisted across restarts (in scope for accelerators-only).
- `npm run lint`, `npm run test`, `npm run type-coverage`, and `npm run build` are green.

## Steps

1. **[backend] Add a per-platform application-menu builder, with tests.**
   - Adds: `src/main/menu.ts`, `src/main/menu.test.ts`.
   - `menu.ts` exports a pure `buildMenuTemplate(platform: NodeJS.Platform): MenuItemConstructorOptions[]`
     returning the macOS vs non-macOS template described above, and an `installApplicationMenu()` that
     calls `Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(process.platform)))`.
   - `menu.test.ts` exercises the pure builder: on `'darwin'` the template includes an `appMenu` and an
     `editMenu` role and a `View` submenu containing the three zoom roles; on `'win32'`/`'linux'` it
     includes `editMenu` and the zoom `View` submenu and no `appMenu`; the `View` submenu never
     contains a `reload`/`toggleDevTools` item.

2. **[backend] Install the menu on startup.**
   - Changes: `src/main/index.ts`.
   - Import and call `installApplicationMenu()` inside `app.whenReady()`, alongside the existing app-id
     / shortcut setup. `autoHideMenuBar: true` on the `BrowserWindow` is unchanged.
   - No test lands with this step: it is one wiring call with no branching logic (the logic lives in
     the tested builder). Manual verification: launch the app and press the shortcuts.

3. **[docs] Remove this plan.** Delete `docs/plans/window-zoom-accelerators.md` in its own `docs:`
   commit (performed by `finish-plan`).

## Constraints

- Backend-only; no `src/shared` contract change, no IPC channel, no renderer change, no new
  dependency.
- Minimal diff: touch only `src/main/index.ts` and the new `src/main/menu.*` files. Keep the existing
  window options and lifecycle code intact.
- No `os/`-per-platform folder: a single builder branching on `process.platform` is the idiomatic
  Electron shape — don't add indirection this doesn't need.
- No e2e manifest id / spec: this adds no IPC channel and no renderer-visible surface the real-app
  harness can drive (the shortcut is an OS menu accelerator, not a DOM interaction), so the coverage
  audit does not apply.

## Open questions

- None. (SETTLED: Option B — cross-platform menu that preserves each OS's standard menus; accelerators
  only, no in-app persisted text-size setting.)
