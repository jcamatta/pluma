// AssistantMarkdown renders markdown into real marks (not raw asterisks) with our tokens. Pure: text in,
// React out.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssistantMarkdown } from '../AssistantMarkdown.view'

describe('AssistantMarkdown', () => {
  it('renders bold as <strong>, not raw asterisks', () => {
    render(<AssistantMarkdown text="make it **bold**" />)

    const strong = screen.getByText('bold')
    expect(strong.tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*bold\*\*/)).not.toBeInTheDocument()
  })

  it('renders italic as <em>', () => {
    render(<AssistantMarkdown text="a *whisper* here" />)

    expect(screen.getByText('whisper').tagName).toBe('EM')
  })

  it('renders inline code as <code>', () => {
    render(<AssistantMarkdown text="run `npm test` now" />)

    expect(screen.getByText('npm test').tagName).toBe('CODE')
  })

  it('renders links as anchors with the href', () => {
    render(<AssistantMarkdown text="see [docs](https://example.com)" />)

    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('renders a bullet list', () => {
    render(<AssistantMarkdown text={'- one\n- two'} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('one')
  })

  it('renders a heading', () => {
    render(<AssistantMarkdown text="# Title" />)

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
  })

  it('passes plain text through unchanged', () => {
    render(<AssistantMarkdown text="just words" />)

    expect(screen.getByText('just words')).toBeInTheDocument()
  })
})
