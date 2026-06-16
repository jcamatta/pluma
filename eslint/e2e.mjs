// ESLint rules for the e2e suite (e2e/**). This is a distinct context from the app: Node + the
// Playwright runner driving the *real* built desktop app, not renderer/main source. It keeps the
// project's hard bans (no escape hatches, no `as`, no disable directives, no `let` — all still apply
// via the shared config), but relaxes two app-code rules that do not fit a test harness:
//
//  - `no-param-reassign` (props): the folder-picker stub overrides Electron's `dialog.showOpenDialog`
//    singleton inside `app.evaluate`, which runs in the real main process. Overriding a native dialog
//    for a test inherently mutates that Electron object; this is the sanctioned single stub, not app
//    state. The "Data = plain values" intent this rule protects is an app concern, not a harness one.
//  - default exports: Playwright's `globalSetup` and `playwright.config.ts` are framework entry points
//    whose contract is a default export, exactly like main.tsx / *.config.ts already are.
//
// This block does not touch app code and adds no new exemption to any src/ file.

export const e2e = {
  files: ['e2e/**/*.ts', 'playwright.config.ts', 'playwright.perf.config.ts'],
  rules: {
    'no-param-reassign': 'off',
    'import-x/no-default-export': 'off'
  }
}
