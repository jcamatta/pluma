// The editor's full extension set, in the order TipTap registers them (input rules depend on order:
// Typography before Markdown). Includes the agent-facing range/annotation/proposal trackers.

import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Document from '@tiptap/extension-document'
import Dropcursor from '@tiptap/extension-dropcursor'
import Gapcursor from '@tiptap/extension-gapcursor'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image from '@tiptap/extension-image'
import Italic from '@tiptap/extension-italic'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Text from '@tiptap/extension-text'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import { Markdown } from '@tiptap/markdown'
import { UndoRedo } from '@tiptap/extensions'
import type { AnyExtension } from '@tiptap/core'
import { PlaceholderExtension } from './placeholder'
import { RangesExtension } from './ranges'
import { AnnotationsExtension } from './annotations'
import { ProposalsExtension } from './proposals'

export const editorExtensions: AnyExtension[] = [
  Document,
  Paragraph.configure(),
  Text,
  Heading.configure({
    levels: [1, 2, 3]
  }),
  Blockquote.configure(),
  BulletList.configure(),
  OrderedList.configure(),
  ListItem.configure(),
  ListKeymap,
  HorizontalRule.configure(),
  Image.configure({ allowBase64: true }),
  HardBreak,
  Bold.configure(),
  Italic,
  Strike,
  Underline,
  Code.configure(),
  CodeBlock.configure(),
  Dropcursor.configure(),
  Gapcursor,
  UndoRedo,
  RangesExtension,
  AnnotationsExtension,
  ProposalsExtension,
  PlaceholderExtension,
  Typography,
  Markdown
]
