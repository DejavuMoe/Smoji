import { RotateCw } from 'lucide-react'
import { Logo } from '../ui/primitives'

export function BootLoading() {
  return (
    <div className="boot" aria-busy="true">
      <aside className="boot__rail" aria-hidden="true">
        <span className="boot__brand"><Logo /><i /></span>
        {Array.from({ length: 14 }, (_, index) => <i key={index} className="boot__row" style={{ animationDelay: `${index * 40}ms` }} />)}
      </aside>
      <main className="boot__sheet">
        <i className="boot__title" />
        <i className="boot__meta" />
        <div className="boot__grid" aria-hidden="true">
          {Array.from({ length: 36 }, (_, index) => <i key={index} style={{ animationDelay: `${(index % 12) * 30}ms` }} />)}
        </div>
        <div role="status" className="boot__status">加载表情工作台...</div>
      </main>
    </div>
  )
}

export function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="boot-error">
      <div className="boot-error__card" role="alert">
        <Logo size={40} />
        <h1>无法加载表情清单</h1>
        <p>{message}</p>
        <button type="button" className="btn btn--ink" onClick={onRetry}><RotateCw aria-hidden="true" />重试加载</button>
      </div>
    </div>
  )
}
