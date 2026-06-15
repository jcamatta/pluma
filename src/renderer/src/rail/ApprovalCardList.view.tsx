// Lays out the pending gated-tool approvals above the composer: a fixed-height container holding one
// animated ApprovalCard per pending item. Pure props — the controller reads the store, parses each call's
// args into `paths`, and resolves the translated labels; this only positions, animates entrance/exit, and
// renders. Nothing is shown when there are no cards, so the container (and its testid) only mount with work.

import { AnimatePresence } from 'motion/react'
import { ApprovalCard, type ApprovalCardProps } from './ApprovalCard.view'

interface ApprovalCardListProps {
  readonly cards: readonly ApprovalCardProps[]
}

function ApprovalCardList({ cards }: ApprovalCardListProps): React.JSX.Element | null {
  if (cards.length === 0) return null

  return (
    <div className="flex-none px-4 pb-2" data-testid="approval-cards">
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <ApprovalCard key={card.toolCallId} {...card} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export { ApprovalCardList }
export type { ApprovalCardListProps }
