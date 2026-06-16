// Generates a large but deterministic markdown manuscript to measure how the editor copes with a real
// novel-sized file. Deterministic (a fixed vocabulary cycled by index, no randomness) so the same word
// count always yields the same document and runs stay comparable. The heading is stable so a spec can
// wait on it to know the document has rendered.

const VOCABULARY = [
  'the',
  'manuscript',
  'unfolded',
  'slowly',
  'across',
  'pages',
  'of',
  'memory',
  'where',
  'characters',
  'wandered',
  'through',
  'chapters',
  'unwritten',
  'and',
  'half',
  'remembered',
  'scenes',
  'returned',
  'again'
]

const PARAGRAPH_WORDS = 80

const paragraph = (start: number, length: number): string =>
  Array.from({ length }, (_, i) => VOCABULARY[(start + i) % VOCABULARY.length]).join(' ')

const largeMarkdown = (wordCount: number): string => {
  const count = Math.ceil(wordCount / PARAGRAPH_WORDS)
  const body = Array.from({ length: count }, (_, p) =>
    paragraph(p * PARAGRAPH_WORDS, PARAGRAPH_WORDS)
  )
  return `# Large manuscript\n\n${body.join('\n\n')}\n`
}

export { largeMarkdown }
