// EditorTabStrip renders one Base UI tab per open file inside a Tabs.Root: the active tab is selected,
// clicking another tab activates it through the root, the per-tab close button fires onClose without
// activating, and the settings button fires onOpenSettings.

import { describe, expect, it, vi, type Mock } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Tabs } from '@base-ui/react/tabs'
import { EditorTabStrip } from '../EditorTabStrip.view'
import type { EditorTab } from '../editor-tabs-logic'

const tabs: readonly EditorTab[] = [
  { path: '/a/alpha.md', name: 'Alpha' },
  { path: '/b/beta.md', name: 'Beta' }
]

function makeSpies(): {
  onValueChange: Mock<(value: unknown, details: unknown) => void>
  onClose: Mock<(path: string) => void>
  onOpenSettings: Mock<() => void>
} {
  return { onValueChange: vi.fn(), onClose: vi.fn(), onOpenSettings: vi.fn() }
}

function renderStrip(value: string, spies: ReturnType<typeof makeSpies>): void {
  render(
    <Tabs.Root value={value} onValueChange={spies.onValueChange}>
      <EditorTabStrip
        tabs={tabs}
        settingsLabel="Settings"
        closeLabel={(name) => `Close ${name}`}
        onClose={spies.onClose}
        onOpenSettings={spies.onOpenSettings}
      />
    </Tabs.Root>
  )
}

describe('EditorTabStrip', () => {
  it('renders a tab per open file and marks the active one', () => {
    renderStrip('/a/alpha.md', makeSpies())
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false')
  })

  it('activates a tab through the Tabs root when clicked', () => {
    const spies = makeSpies()
    renderStrip('/a/alpha.md', spies)
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(spies.onValueChange).toHaveBeenCalledWith('/b/beta.md', expect.anything())
  })

  it('closes a tab without activating it', () => {
    const spies = makeSpies()
    renderStrip('/a/alpha.md', spies)
    fireEvent.click(screen.getByRole('button', { name: 'Close Beta' }))
    expect(spies.onClose).toHaveBeenCalledWith('/b/beta.md')
    expect(spies.onValueChange).not.toHaveBeenCalled()
  })

  it('opens settings from the strip', () => {
    const spies = makeSpies()
    renderStrip('/a/alpha.md', spies)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(spies.onOpenSettings).toHaveBeenCalledOnce()
  })
})
