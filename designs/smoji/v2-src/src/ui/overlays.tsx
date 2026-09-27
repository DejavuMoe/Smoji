import type { ReactNode } from 'react'
import { AlertDialog, Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useFocusReturn } from '@wb/focus-return'

interface ConfirmProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
  returnSelector?: string
  fallbackSelector?: string
}

/** Destructive and import confirmations: initial focus always lands on 取消. */
export function Confirm({ open, title, description, confirmLabel = '确认', tone = 'danger', onConfirm, onCancel, returnSelector, fallbackSelector }: ConfirmProps) {
  const focusReturn = useFocusReturn(fallbackSelector, returnSelector)
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="ov" />
        <AlertDialog.Content className="dlg confirm" {...focusReturn}>
          <AlertDialog.Title className="confirm__title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="confirm__desc">{description}</AlertDialog.Description>
          <div className="confirm__actions">
            <AlertDialog.Cancel className="btn btn--ghost" onClick={onCancel}>取消</AlertDialog.Cancel>
            <AlertDialog.Action className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--ink'}`} onClick={onConfirm}>
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  side: 'left' | 'bottom'
  id?: string
  children: ReactNode
  fallbackSelector?: string
  returnSelector?: string
}

export function Sheet({ open, onOpenChange, title, side, id, children, fallbackSelector, returnSelector }: SheetProps) {
  const focusReturn = useFocusReturn(fallbackSelector, returnSelector)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ov ov--sheet" />
        <Dialog.Content id={id} className={`sheet sheet--${side}`} aria-describedby={undefined} {...focusReturn}>
          <div className="sheet__head">
            {side === 'bottom' && <span className="sheet__grip" aria-hidden="true" />}
            <Dialog.Title className="sheet__title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label={`关闭${title}`}><X aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="sheet__body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
