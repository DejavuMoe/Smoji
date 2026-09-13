import { useEffect, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'

interface DeleteConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  title = '删除分组确认',
  description = '确定要删除该自选分组吗？此操作可通过撤销 (⌘+Z) 恢复。',
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)

  // Explicit safety requirement: Cancel button MUST receive initial focus
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent
        id="confirm-modal"
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelBtnRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <button
            ref={cancelBtnRef}
            id="confirm-cancel"
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
            onClick={onCancel}
          >
            取消
          </button>
          <button
            id="confirm-ok"
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-destructive px-3 text-xs font-medium text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onConfirm}
          >
            确定
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
