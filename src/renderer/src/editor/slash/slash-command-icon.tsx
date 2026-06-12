// Maps a slash command id to its lucide glyph. Kept out of the catalog so the data layer stays free of JSX;
// this is a pure view helper with no state.

import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  TextQuote,
  Type
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SlashCommandId } from './slash-command-catalog'

type SlashCommandIconProps = {
  readonly id: SlashCommandId
}

const icons: Record<SlashCommandId, LucideIcon> = {
  text: Type,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  bulletList: List,
  orderedList: ListOrdered,
  quote: TextQuote,
  codeBlock: Code,
  divider: Minus
}

function SlashCommandIcon({ id }: SlashCommandIconProps): React.JSX.Element {
  const Icon = icons[id]
  return <Icon size={17} className="text-text-secondary" />
}

export { SlashCommandIcon }
export type { SlashCommandIconProps }
