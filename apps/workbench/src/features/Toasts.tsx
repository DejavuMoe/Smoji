import { useEffect, useState } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'
import { dismissToast, subscribeToasts, type ToastItem } from './feedback/toast'

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setItems), [])
  return (
    <div id="toast-container" className="toasts" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast" data-type={item.type}
          role={item.type === 'error' ? 'alert' : 'status'} aria-live={item.type === 'error' ? 'assertive' : 'polite'}>
          {item.type === 'error' ? <AlertCircle aria-hidden="true" /> : item.type === 'success' ? <Check aria-hidden="true" strokeWidth={2.6} /> : null}
          <span className="toast__text">{item.message}</span>
          {item.action && <button type="button" className="toast__action" onClick={item.action.run}>{item.action.label}</button>}
          <button type="button" className="toast__x" aria-label="关闭通知" onClick={() => dismissToast(item.id)}><X aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  )
}
