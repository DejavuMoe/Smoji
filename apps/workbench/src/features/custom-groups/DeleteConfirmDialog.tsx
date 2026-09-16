import { Button } from '../../components/ui/button'
import { useRef } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { useFocusReturn } from '../../focus-return'

interface DeleteConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  /** Where focus lands when the remembered trigger was removed by the confirmed action. */
  fallbackSelector?: string
  returnSelector?: string
}

export function DeleteConfirmDialog({
  open,
  title = '删除分组确认',
  description = '确定要删除该自选分组吗？此操作可通过撤销 (⌘/Ctrl+Z) 恢复。',
  onConfirm,
  onCancel,
  fallbackSelector = '#custom-create summary',
  returnSelector,
}: DeleteConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)

  const focusReturn = useFocusReturn(fallbackSelector, returnSelector)

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent {...focusReturn}
        id="confirm-modal"
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          focusReturn.onOpenAutoFocus(e)
          e.preventDefault()
          cancelBtnRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <Button variant="ghost"
            ref={cancelBtnRef}
            id="confirm-cancel"
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted "
            onClick={onCancel}
          >
            取消
          </Button>
          <Button variant="ghost"
            id="confirm-ok"
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-destructive px-3 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 "
            onClick={onConfirm}
          >
            确定
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
