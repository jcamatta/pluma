// Pure calculation: flatten an AG-UI message's content to display text. Content is a plain string for
// most messages; when it is an array of parts, the text parts are joined. Anything else (no content,
// non-text parts) yields an empty string. Used to render a loaded thread's transcript.

import type { Message } from '@ag-ui/core'

function messageText(message: Message): string {
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
  }
  return ''
}

export { messageText }
