export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

type Listener = (toasts: ToastItem[]) => void
const listeners: Set<Listener> = new Set()
let toasts: ToastItem[] = []

function notify() {
  for (const listener of listeners) {
    listener([...toasts])
  }
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  listener([...toasts])
  return () => {
    listeners.delete(listener)
  }
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  action?: { label: string; run: () => void },
): void {
  // If ToastContainer DOM container exists outside React (e.g. in legacy tests):
  const container = document.getElementById('toast-container')
  if (container && !listeners.size) {
    const toast = document.createElement('div')
    toast.className = `toast toast--${type} flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md`
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status')
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
    toast.setAttribute('aria-atomic', 'true')

    const text = document.createElement('span')
    text.className = 'toast__text text-foreground font-medium'
    text.textContent = message
    toast.append(text)

    if (action) {
      const btn = document.createElement('button')
      btn.className = 'toast__action rounded bg-primary/10 px-2 py-0.5 text-primary'
      btn.textContent = action.label
      btn.onclick = action.run
      toast.append(btn)
    }

    const dismiss = document.createElement('button')
    dismiss.className = 'toast__dismiss text-muted-foreground hover:text-foreground'
    dismiss.setAttribute('aria-label', '关闭通知')
    dismiss.textContent = '✕'
    dismiss.onclick = () => toast.remove()
    toast.append(dismiss)

    container.append(toast)
    setTimeout(() => toast.remove(), type === 'error' ? 5000 : 3000)
    return
  }

  const id = `${Date.now()}-${Math.random()}`
  toasts = [...toasts, { id, message, type, action }]
  notify()
  setTimeout(() => dismissToast(id), type === 'error' ? 5000 : 3000)
}
