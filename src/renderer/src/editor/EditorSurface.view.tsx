// The editor surface's vertical stack: the suggestions sub-topbar (bar) above the scrolling manuscript
// (body). A pure layout view so the controller carries no layout of its own — it only fills the editor stack
// and lets the manuscript take the remaining height while the bar stays its natural size at the top.

interface EditorSurfaceProps {
  readonly bar: React.ReactNode
  readonly body: React.ReactNode
}

function EditorSurface({ bar, body }: EditorSurfaceProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {bar}
      {body}
    </div>
  )
}

export { EditorSurface }
export type { EditorSurfaceProps }
