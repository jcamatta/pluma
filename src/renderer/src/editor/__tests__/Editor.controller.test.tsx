// EditorController mounts the manuscript editor, renders the view once the editor is ready, and loads
// the markdown content prop into the surface.

import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { EditorController } from '../Editor.controller'

describe('EditorController', () => {
  it('renders the editor surface once the editor instance is ready', async () => {
    const { container } = render(<EditorController content={null} />)

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })

  it('loads the markdown content into the editor surface', async () => {
    const { container } = render(<EditorController content={'# Chapter One'} />)

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror h1')?.textContent).toBe('Chapter One')
    })
  })
})
