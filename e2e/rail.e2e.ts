// Real-app e2e for the conversation rail. Drives the actual built desktop app: opens a real folder to
// reach the shell, types a prompt into the rail's composer, starts a real agent run (agent.run over IPC),
// and asserts the live AG-UI event stream (agent.event) folds into a visible user bubble, a settled
// "Worked" activity, and a streamed assistant reply — exactly as a writer chatting with the assistant
// would see it. The reply comes from a real Claude call, so the prompt pins the answer to a sentinel word
// and the assertion is case-insensitive with a generous timeout for the network round-trip. Nothing about
// the agent is mocked; only the native folder dialog is stubbed (the one sanctioned human-gesture stub).
//
// @e2e feature:rail
// @e2e operation:agent.run operation:agent.event operation:agent.abort

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

// A reply this constrained is deterministic enough to assert on without coupling to model phrasing. The
// sentinel is wrapped in bold markdown so the reply also proves the rail renders markdown as marks (a
// <strong>), not raw asterisks.
const SENTINEL = 'PLUMA'
const PROMPT = `Reply with exactly this and nothing else: **${SENTINEL}**`

// A real Claude round-trip (network + streamed generation) needs well over Playwright's 30s default.
test.setTimeout(120_000)

test('sends a message and shows the assistant reply in the rail', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      // Get past the launcher into the shell; the rail mounts open by default.
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      // Reaching the shell runs a real folder pick → list-folder → OS watcher, which on a cold launch
      // can take longer than Playwright's 5s default; wait generously for the rail to mount.
      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // Type the prompt and send it (the composer submits on the Send button).
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // The user's message appears immediately as a bubble. The prompt also shows in the header title,
      // so scope to the bubble (the accent-surfaced message div) to keep the match unambiguous.
      const bubble = rail.locator('.bg-action-primary.text-text-on-accent', { hasText: PROMPT })
      await expect(bubble).toBeVisible()

      // The run settles: the activity header flips from the working spinner to "Worked".
      await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 60_000 })

      // The streamed reply lands and contains the sentinel the prompt pinned, rendered as bold markdown
      // (a real <strong>) rather than raw `**PLUMA**`.
      const reply = rail.getByTestId('assistant-reply')
      await expect(reply).toBeVisible({ timeout: 60_000 })
      await expect(reply).toContainText(SENTINEL, { ignoreCase: true })
      await expect(reply.locator('strong')).toContainText(SENTINEL, { ignoreCase: true })

      // Multi-turn: a second message must NOT erase the first turn (the reported bug). Send a follow-up
      // and let it complete; the first turn's reply settles into history above the new turn, so both
      // user bubbles and both replies stay on screen with their own sentinels. (The precise guarantee
      // that the two turns get distinct, non-colliding message ids — the root cause of the bleed — is
      // pinned by the unit tests on the stream transform; here we exercise the whole multi-turn path
      // end to end and prove the first turn survives a second.)
      const SECOND = 'Reply with exactly the single word RAIL and nothing else.'
      await composer.click()
      await composer.fill(SECOND)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      const secondBubble = rail.locator('.bg-action-primary.text-text-on-accent', {
        hasText: SECOND
      })
      await expect(secondBubble).toBeVisible()
      await expect(bubble).toBeVisible()
      await expect(rail.getByText('RAIL', { exact: false })).toBeVisible({ timeout: 60_000 })
      await expect(rail.getByText(SENTINEL, { exact: false }).first()).toBeVisible()
    } finally {
      await app.close()
    }
  })
})

test('changes the model and effort from the composer selectors', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // The composer footer carries the two run-control selectors at their defaults (Opus 4.8 / Medium).
      const modelSelect = rail.getByLabel('Model')
      const effortSelect = rail.getByLabel('Effort')
      await expect(modelSelect).toContainText('Opus 4.8')
      await expect(effortSelect).toContainText('Medium')

      // Picking a different model updates the trigger — the choice rides the next run's state over IPC.
      await modelSelect.click()
      await window.getByRole('option', { name: 'Sonnet 4.6' }).click()
      await expect(modelSelect).toContainText('Sonnet 4.6')

      // Picking a different effort likewise updates its trigger.
      await effortSelect.click()
      await window.getByRole('option', { name: 'High' }).click()
      await expect(effortSelect).toContainText('High')
    } finally {
      await app.close()
    }
  })
})

// A prompt whose answer is long enough that the run is still streaming when we hit Stop, so the abort
// has something live to cancel rather than racing a reply that already finished.
const LONG_PROMPT = 'Write a detailed 2000-word essay about the history of the written word.'

test('stops an in-flight run with the composer Stop button', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      // Same cold-launch transition as the reply test — wait generously for the shell to mount.
      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(LONG_PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // While the run is in flight the composer swaps Send for Stop; its appearance confirms the run
      // actually started (agent.run) and is still working, so there is something to abort.
      const stop = rail.getByRole('button', { name: 'Stop', exact: true })
      await expect(stop).toBeVisible({ timeout: 60_000 })

      // Aborting the run (agent.abort over IPC) settles it: the Stop control gives way to Send again.
      await stop.click()
      await expect(rail.getByRole('button', { name: 'Send', exact: true })).toBeVisible({
        timeout: 60_000
      })
      await expect(stop).toBeHidden()
    } finally {
      await app.close()
    }
  })
})
