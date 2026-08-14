// Real-app e2e for the rail's typed run-failure header. Drives the actual built desktop app with the
// Claude SDK deliberately signed out: CLAUDE_CONFIG_DIR points at an EMPTY temp directory and the three
// credential env keys (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN) are removed
// from the inherited environment, so the SDK finds no sign-in wherever it looks. Nothing is mocked: the
// real agent.run → SDK → RUN_ERROR(code) → rail path runs; only the native folder dialog is stubbed (the
// one sanctioned human-gesture stub).
//
// Two things are asserted, because either alone would be weak:
//  1. The lever actually reached the running main process (the app's own process.env), so a green run is
//     not green because the override silently did nothing.
//  2. The rail's failed-run header shows the sign-in title AND the remedy line beneath it — the remedy
//     is the whole point of the typed failure, and it renders outside the step-timeline gate.
// Then a SECOND message is sent: while signed out every run fails, and the writer must keep seeing the
// same title and remedy rather than a stale or blank header.
//
// Honest caveat observed while writing this: the ambient Claude token on the development machine is
// currently EXPIRED, so a run fails even without the lever — with a different SDK message ("401 OAuth
// access token has expired" versus "Not logged in · Please run /login" under an empty config dir). The
// UI never renders the SDK's prose, so this spec cannot distinguish them from the rail alone; assertion
// (1) is what pins the setup. Both paths map to the same 'authentication' failure code, which is the
// behaviour under test.
//
// The failure lands in seconds (no network round-trip, no prompt), so the whole spec is bounded well
// below the agent specs' 180s: a slow run means the lever stopped working.
//
// @e2e feature:rail

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

// The English copy of rail.runError.authentication.{title,remedy}.
const TITLE = 'Sign-in expired'
const REMEDY = 'Sign in to Claude again from your terminal, then restart Pluma.'

const FIRST_PROMPT = 'Say hello.'
const SECOND_PROMPT = 'Say hello again.'

test.setTimeout(60_000)

test('shows the sign-in failure and its remedy when the agent has no valid sign-in', async () => {
  // The config dir must be a real, empty directory: the SDK reads it instead of ~/.claude, finds no
  // credentials there, and fails immediately.
  await withTempFolder([], async (configDir) => {
    await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
      const { app, window } = await launchApp({
        CLAUDE_CONFIG_DIR: configDir,
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_AUTH_TOKEN: undefined,
        CLAUDE_CODE_OAUTH_TOKEN: undefined
      })
      try {
        // The lever reached the real main process — the app is running signed out, whatever this
        // machine has exported.
        const mainEnv = await app.evaluate(() => ({
          configDir: process.env.CLAUDE_CONFIG_DIR ?? '',
          apiKey: process.env.ANTHROPIC_API_KEY ?? '',
          authToken: process.env.ANTHROPIC_AUTH_TOKEN ?? '',
          oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ''
        }))
        expect(mainEnv.configDir).toBe(configDir)
        expect(mainEnv.apiKey).toBe('')
        expect(mainEnv.authToken).toBe('')
        expect(mainEnv.oauthToken).toBe('')

        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const rail = window.getByTestId('conversation-rail')
        await expect(rail).toBeVisible({ timeout: 30_000 })

        const composer = rail.locator('textarea[data-rail-composer]')
        const send = rail.getByRole('button', { name: 'Send', exact: true })
        const stop = rail.getByRole('button', { name: 'Stop', exact: true })
        const title = rail.getByText(TITLE, { exact: true })
        const remedy = rail.getByText(REMEDY, { exact: true })

        await composer.click()
        await composer.fill(FIRST_PROMPT)
        await send.click()

        // Stop → Send is the run's real settle signal (a streamed reply is not one). Seeing Stop also
        // proves the run genuinely started rather than being rejected before it began.
        await expect(stop).toBeVisible({ timeout: 10_000 })
        await expect(send).toBeVisible({ timeout: 15_000 })

        await expect(title).toBeVisible()
        await expect(remedy).toBeVisible()

        // A second turn while still signed out: the header passes back through the run and fails afresh,
        // so the writer sees the same title and remedy again — one header, on the current turn.
        await composer.click()
        await composer.fill(SECOND_PROMPT)
        await send.click()

        await expect(stop).toBeVisible({ timeout: 10_000 })
        await expect(send).toBeVisible({ timeout: 15_000 })

        await expect(title).toHaveCount(1)
        await expect(remedy).toHaveCount(1)
        await expect(title).toBeVisible()
        await expect(remedy).toBeVisible()
      } finally {
        await app.close()
      }
    })
  })
})
