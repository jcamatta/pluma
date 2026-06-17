// Controlled delete-confirmation dialog for a thread, built on the Base UI AlertDialog primitive and
// animated with Motion (backdrop fades, popup fades + scales in via the render prop). Pure props: the
// caller owns the open state and supplies the resolved labels and the confirm/cancel callbacks. Confirm
// is a plain action button (closing follows from the caller clearing the pending state); cancel and the
// backdrop/escape route through onCancel.

import { AlertDialog, Button } from '@base-ui/react'
import { motion } from 'motion/react'

interface ThreadDeleteDialogLabels {
  readonly title: string
  readonly message: string
  readonly confirm: string
  readonly cancel: string
}

interface ThreadDeleteDialogProps {
  readonly open: boolean
  readonly labels: ThreadDeleteDialogLabels
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ThreadDeleteDialog({
  open,
  labels,
  onConfirm,
  onCancel
}: ThreadDeleteDialogProps): React.JSX.Element {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className="fixed inset-0 bg-overlay"
          render={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
        />
        <AlertDialog.Popup
          className="fixed left-1/2 top-1/2 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface-2 p-5 shadow-lg"
          render={
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} />
          }
        >
          <AlertDialog.Title className="text-sm font-semibold text-text-primary">
            {labels.title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-text-secondary">
            {labels.message}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-(--hover)">
              {labels.cancel}
            </AlertDialog.Close>
            <Button
              onClick={onConfirm}
              className="rounded-lg bg-action-destructive px-3 py-2 text-sm font-semibold text-text-on-accent"
            >
              {labels.confirm}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export type { ThreadDeleteDialogLabels, ThreadDeleteDialogProps }
