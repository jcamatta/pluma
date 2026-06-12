// Runs a chosen slash command: deletes the trigger range (the `/query` text Suggestion tracked) and turns
// the current block into the selected type, in one chain so the conversion is a single undo step. The
// id→chain mapping is the only logic; the rest is a thin action over the editor.

import type { ChainedCommands, Editor, Range } from '@tiptap/core'
import type { SlashCommandId } from './slash-command-catalog'

type ApplySlashCommandInput = {
  readonly editor: Editor
  readonly id: SlashCommandId
  readonly range: Range
}

const blockCommand: Record<SlashCommandId, (chain: ChainedCommands) => ChainedCommands> = {
  text: (chain) => chain.setParagraph(),
  heading1: (chain) => chain.setHeading({ level: 1 }),
  heading2: (chain) => chain.setHeading({ level: 2 }),
  heading3: (chain) => chain.setHeading({ level: 3 }),
  bulletList: (chain) => chain.toggleBulletList(),
  orderedList: (chain) => chain.toggleOrderedList(),
  quote: (chain) => chain.toggleBlockquote(),
  codeBlock: (chain) => chain.toggleCodeBlock(),
  divider: (chain) => chain.setHorizontalRule()
}

function applySlashCommand({ editor, id, range }: ApplySlashCommandInput): void {
  blockCommand[id](editor.chain().focus().deleteRange(range)).run()
}

export { applySlashCommand }
export type { ApplySlashCommandInput }
