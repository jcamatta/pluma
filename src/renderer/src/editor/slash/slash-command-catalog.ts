// The block types the slash menu offers — only those the editor schema can render today (headings stop at
// level 3; there is no task list, toggle, or page node). Plain Data: `labelKey` is resolved to text in the
// view, `hint` is the markdown shortcut shown on the right of each row, and `keywords` are the English
// search terms the filter matches, since the translated label is not available in this layer.

type SlashCommandId =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'codeBlock'
  | 'divider'

type SlashCommandItem = {
  readonly id: SlashCommandId
  readonly labelKey: string
  readonly hint: string
  readonly keywords: readonly string[]
}

const slashCommands: readonly SlashCommandItem[] = [
  { id: 'text', labelKey: 'editor.slash.text', hint: '', keywords: ['text', 'paragraph', 'plain'] },
  {
    id: 'heading1',
    labelKey: 'editor.slash.heading1',
    hint: '#',
    keywords: ['heading', 'h1', 'title']
  },
  {
    id: 'heading2',
    labelKey: 'editor.slash.heading2',
    hint: '##',
    keywords: ['heading', 'h2', 'subtitle']
  },
  { id: 'heading3', labelKey: 'editor.slash.heading3', hint: '###', keywords: ['heading', 'h3'] },
  {
    id: 'bulletList',
    labelKey: 'editor.slash.bulletList',
    hint: '-',
    keywords: ['bulleted', 'bullet', 'list', 'unordered']
  },
  {
    id: 'orderedList',
    labelKey: 'editor.slash.orderedList',
    hint: '1.',
    keywords: ['numbered', 'ordered', 'list']
  },
  {
    id: 'quote',
    labelKey: 'editor.slash.quote',
    hint: '>',
    keywords: ['quote', 'blockquote', 'citation']
  },
  {
    id: 'codeBlock',
    labelKey: 'editor.slash.codeBlock',
    hint: '```',
    keywords: ['code', 'codeblock', 'snippet']
  },
  {
    id: 'divider',
    labelKey: 'editor.slash.divider',
    hint: '---',
    keywords: ['divider', 'horizontal', 'rule', 'separator', 'hr']
  }
]

export { slashCommands }
export type { SlashCommandId, SlashCommandItem }
