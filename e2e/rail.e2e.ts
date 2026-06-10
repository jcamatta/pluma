// Real-app e2e for the conversation rail. Drives the actual built desktop app: opens a real folder to
// reach the shell, types a prompt into the rail's composer, starts a real agent run (agent.run over IPC),
// and asserts the live AG-UI event stream (agent.event) folds into a visible user bubble, a settled
// "Worked" activity, and a streamed assistant reply — exactly as a writer chatting with the assistant
// would see it. The reply comes from a real Claude call, so the prompt pins the answer to a sentinel word
// and the assertion is case-insensitive with a generous timeout for the network round-trip. Nothing about
// the agent is mocked; only the native folder dialog is stubbed (the one sanctioned human-gesture stub).
//
// @e2e feature:rail
// @e2e operation:agent.run operation:agent.event

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

// A reply this constrained is deterministic enough to assert on without coupling to model phrasing.
const SENTINEL = 'PLUMA'
const PROMPT = `Reply with exactly the single word ${SENTINEL} and nothing else.`

// A real Claude round-trip (network + streamed generation) needs well over Playwright's 30s default.
test.setTimeout(120_000)

test('sends a message and shows the assistant reply in the rail', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      // Get past the launcher into the shell; the rail mounts open by default.
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible()

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

      // The streamed reply lands and contains the sentinel the prompt pinned.
      const reply = rail.getByTestId('assistant-reply')
      await expect(reply).toBeVisible({ timeout: 60_000 })
      await expect(reply).toContainText(SENTINEL, { ignoreCase: true })
    } finally {
      await app.close()
    }
  })
})
