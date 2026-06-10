// The user's message bubble, right-aligned. The design's bubble uses an inverse surface we don't have,
// so it uses the accent pairing the composer's Send button already uses against this surface. The bubble
// radius is sub-scale, so it goes through `style`.

export function UserMessage({ text }: { readonly text: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex justify-end">
      <div
        className="bg-action-primary text-sm leading-snug text-text-on-accent"
        style={{ maxWidth: '86%', borderRadius: '14px 14px 5px 14px', padding: '9px 13px' }}
      >
        {text}
      </div>
    </div>
  )
}
