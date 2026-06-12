// Slash-menu filtering: case-insensitive substring match against each item's keywords, empty query keeps
// everything, catalog order preserved.

import { describe, expect, it } from 'vitest'
import { slashCommands } from '../slash-command-catalog'
import { filterSlashCommands } from '../filter-slash-commands'
import type { SlashCommandItem } from '../slash-command-catalog'

const ids = (items: readonly SlashCommandItem[]): readonly string[] => items.map((item) => item.id)

describe('filterSlashCommands', () => {
  it('returns the whole catalog for an empty query', () => {
    expect(filterSlashCommands(slashCommands, '')).toEqual(slashCommands)
  })

  it('returns the whole catalog for a whitespace-only query', () => {
    expect(filterSlashCommands(slashCommands, '   ')).toEqual(slashCommands)
  })

  it('matches all headings on a shared keyword prefix', () => {
    expect(ids(filterSlashCommands(slashCommands, 'head'))).toEqual([
      'heading1',
      'heading2',
      'heading3'
    ])
  })

  it('matches a single heading by its level keyword', () => {
    expect(ids(filterSlashCommands(slashCommands, 'h2'))).toEqual(['heading2'])
  })

  it('matches both lists by the shared "list" keyword in catalog order', () => {
    expect(ids(filterSlashCommands(slashCommands, 'list'))).toEqual(['bulletList', 'orderedList'])
  })

  it('is case-insensitive', () => {
    expect(ids(filterSlashCommands(slashCommands, 'HEAD'))).toEqual([
      'heading1',
      'heading2',
      'heading3'
    ])
  })

  it('returns nothing when no keyword contains the query', () => {
    expect(filterSlashCommands(slashCommands, 'zzz')).toEqual([])
  })
})
