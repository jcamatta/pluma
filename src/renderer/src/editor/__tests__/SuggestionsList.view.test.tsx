// The grouped List popover renders Rewrites, then Inserts, then Notes (empty groups omitted), previews each
// suggestion in one line, dims resolved rows, and fires onJump with the clicked suggestion. Labels arrive
// pre-translated as props, so the view is asserted without an i18n provider. The popover is controlled open.

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SuggestionsList } from '../SuggestionsList.view'
import type { Suggestion } from '../suggestion-list'

const labels = {
  rewrites: 'Rewrites',
  inserts: 'Inserts',
  notes: 'Notes',
  read: 'read',
  conflicted: 'conflicted'
}

function rewrite(over: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'p_1',
    type: 'rewrite',
    from: 10,
    to: 14,
    pending: true,
    resolution: null,
    label: 'after',
    quote: '',
    before: 'old text',
    after: 'new text',
    ...over
  }
}

function insert(over: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'p_2',
    type: 'insert',
    from: 20,
    to: 20,
    pending: true,
    resolution: null,
    label: 'added',
    quote: '',
    before: '',
    after: 'added text',
    ...over
  }
}

function note(over: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'a_1',
    type: 'note',
    from: 5,
    to: 9,
    pending: true,
    resolution: null,
    label: 'Telling',
    quote: 'a quoted passage',
    before: '',
    after: '',
    ...over
  }
}

function renderList(
  items: readonly Suggestion[],
  onJump = vi.fn()
): { readonly onJump: typeof onJump } {
  const anchor = createRef<HTMLDivElement>()
  render(
    <>
      <div ref={anchor}>anchor</div>
      <SuggestionsList
        open
        onOpenChange={() => undefined}
        anchor={anchor}
        items={items}
        labels={labels}
        onJump={onJump}
        reduceMotion
      />
    </>
  )
  return { onJump }
}

describe('SuggestionsList', () => {
  it('renders the groups in the fixed order Rewrites, Inserts, Notes', () => {
    renderList([note(), insert(), rewrite()])

    const titles = screen.getAllByText(/Rewrites|Inserts|Notes/)
    expect(titles.map((node) => node.textContent)).toEqual(['Rewrites', 'Inserts', 'Notes'])
  })

  it('omits a group with no items', () => {
    renderList([note()])

    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.queryByText('Rewrites')).not.toBeInTheDocument()
    expect(screen.queryByText('Inserts')).not.toBeInTheDocument()
  })

  it('previews each kind: struck before + green after, green insert, quoted note', () => {
    renderList([rewrite(), insert(), note()])

    expect(screen.getByText('old text')).toBeInTheDocument()
    expect(screen.getByText('new text')).toBeInTheDocument()
    expect(screen.getByText('added text')).toBeInTheDocument()
    expect(screen.getByText('“a quoted passage”')).toBeInTheDocument()
  })

  it('dims resolved rows and shows their status label', () => {
    renderList([
      rewrite({ id: 'p_9', pending: false, resolution: 'conflicted', before: 'gone' }),
      note({ id: 'a_9', pending: false, resolution: 'read' })
    ])

    expect(screen.getByText('conflicted')).toBeInTheDocument()
    expect(screen.getByText('read')).toBeInTheDocument()
    const resolvedRow = screen.getByText('gone').closest('button')
    expect(resolvedRow).toHaveClass('opacity-50')
  })

  it('does not dim a pending row', () => {
    renderList([rewrite()])
    expect(screen.getByText('old text').closest('button')).not.toHaveClass('opacity-50')
  })

  it('fires onJump with the clicked suggestion', () => {
    const item = rewrite()
    const { onJump } = renderList([item])

    fireEvent.click(screen.getByText('old text'))

    expect(onJump).toHaveBeenCalledWith(item)
  })
})
