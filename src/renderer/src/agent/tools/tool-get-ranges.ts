// Handler for `get_ranges`: resolve exact document text to a tracked range id. Builds a flat
// char->position index over the document's text nodes, finds every occurrence of the query, and
// registers a range when there is exactly one. Zero matches -> not_found; many -> ambiguous (with a
// short preview of each). The index and match scan are written without `let`: characters are pushed
// into a const array by the descendant visitor, and occurrences are collected by a recursive scan.

import type { Editor } from '@tiptap/core'
import { setRange } from '../../editor/extensions/ranges'
import type { AgentToolResult } from './types'

interface IndexedChar {
  readonly char: string
  readonly position: number
}

interface DocumentTextIndex {
  readonly text: string
  readonly positions: readonly number[]
}

const PREVIEW_PADDING = 40
const MAX_PREVIEWS = 5

function createDocumentTextIndex(editor: Editor): DocumentTextIndex {
  const chars: IndexedChar[] = []

  editor.state.doc.descendants((node, position) => {
    const nodeText = node.text
    if (!node.isText || !nodeText) return true

    Array.from({ length: nodeText.length }, (_unused, index) =>
      chars.push({ char: nodeText[index], position: position + index })
    )

    return true
  })

  return {
    text: chars.map((entry) => entry.char).join(''),
    positions: chars.map((entry) => entry.position)
  }
}

function findMatches(documentText: string, query: string): readonly number[] {
  const collect = (from: number, acc: readonly number[]): readonly number[] => {
    const index = documentText.indexOf(query, from)
    return index === -1 ? acc : collect(index + query.length, [...acc, index])
  }
  return collect(0, [])
}

interface AmbiguousInput {
  readonly documentText: string
  readonly matches: readonly number[]
  readonly length: number
}

function ambiguousError({ documentText, matches, length }: AmbiguousInput): string {
  const preview = (index: number): string => {
    const start = Math.max(0, index - PREVIEW_PADDING)
    const end = Math.min(documentText.length, index + length + PREVIEW_PADDING)
    return documentText.slice(start, end)
  }
  const previews = matches
    .slice(0, MAX_PREVIEWS)
    .map((index, order) => `${order + 1}: ${preview(index)}`)
    .join('\n')
  return `ambiguous\n${previews}`
}

export function getRanges(editor: Editor, args: { readonly text: string }): AgentToolResult {
  const index = createDocumentTextIndex(editor)
  const matches = findMatches(index.text, args.text)

  if (matches.length === 0) return { ok: false, error: 'not_found' }
  if (matches.length > 1) {
    return {
      ok: false,
      error: ambiguousError({ documentText: index.text, matches, length: args.text.length })
    }
  }

  const start = matches[0]
  const range = setRange({
    editor,
    range: {
      from: index.positions[start],
      to: index.positions[start + args.text.length - 1] + 1,
      originalText: args.text
    }
  })

  return { ok: true, output: { type: 'json', value: { rangeId: range.id, text: args.text } } }
}
