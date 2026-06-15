// Wires the pending gated-tool approvals to the list view. Reads the approvals store, parses each call's
// wire args into the path(s) to show, resolves the action label from the call's kind (falling back to a
// generic label so an unrecognized shape still renders rather than crashing), and maps Approve / Reject to
// the store's resolve. The view renders nothing when there is nothing to approve.

import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useAgentApprovals } from '../agent/AgentApprovalsContext'
import { describeApproval, type ApprovalPaths } from '../agent/approval-logic'
import { type ApprovalCardLabels } from './ApprovalCard.view'
import { ApprovalCardList } from './ApprovalCardList.view'

function actionLabel(paths: ApprovalPaths, t: TFunction): string {
  if (paths.kind === 'create') return t('rail.approval.createFile')
  if (paths.kind === 'rename') return t('rail.approval.renameFile')
  if (paths.kind === 'delete') return t('rail.approval.deleteFile')
  return t('rail.approval.action')
}

function cardLabels(paths: ApprovalPaths, t: TFunction): ApprovalCardLabels {
  return {
    action: actionLabel(paths, t),
    approve: t('rail.approval.approve'),
    reject: t('rail.approval.reject')
  }
}

function ApprovalCardController(): React.JSX.Element {
  const { t } = useTranslation()
  const { pending, resolve } = useAgentApprovals()

  const cards = pending.map((approval) => {
    const paths = describeApproval(approval.toolName, approval.args)
    return {
      toolCallId: approval.toolCallId,
      paths,
      labels: cardLabels(paths, t),
      onApprove: () => resolve(approval.toolCallId, true),
      onReject: () => resolve(approval.toolCallId, false)
    }
  })

  return <ApprovalCardList cards={cards} />
}

export { ApprovalCardController }
