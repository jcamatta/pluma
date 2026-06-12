// Renders an assistant reply's markdown (bold, italic, inline code, links, lists, headings, quotes) with
// our design tokens — react-markdown + GFM, styled through the components map so no raw markup leaks to
// the user. Pure: text in, React out. Only assistant replies use this; user messages stay plain text.

import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components: Components = {
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-action-primary underline">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-2 px-1 font-editor text-xs">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-editor text-xs">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-(--line2) pl-3 text-text-secondary">
      {children}
    </blockquote>
  )
}

export function AssistantMarkdown({ text }: { readonly text: string }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  )
}
