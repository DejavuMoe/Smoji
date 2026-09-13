import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { subscribeToasts, dismissToast, type ToastItem } from './toast'

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts(setItems)
  }, [])

  return (
    <div
      id="toast-container"
      className="toast-container fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm max-sm:left-4 max-sm:right-4 max-sm:max-w-none"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          aria-live={item.type === 'error' ? 'assertive' : 'polite'}
          className="toast pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-sm"
        >
          <span className="toast__text min-w-0 break-words font-medium text-foreground">{item.message}</span>

          <div className="flex shrink-0 items-center gap-1.5">
            {item.action && (
              <button
                type="button"
                className="toast__action rounded bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
                onClick={item.action.run}
              >
                {item.action.label}
              </button>
            )}

            <button
              type="button"
              className="toast__dismiss rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="关闭通知"
              onClick={() => dismissToast(item.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
