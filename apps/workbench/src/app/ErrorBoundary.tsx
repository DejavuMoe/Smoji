import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Logo } from '../ui/primitives'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Smoji Workbench:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="boot-error">
          <div className="boot-error__card" role="alert">
            <Logo size={40} />
            <h1>工作台加载遇到问题</h1>
            <p>{this.state.error?.message || '发生了意外错误，已保护您的本地数据。'}</p>
            <button type="button" className="btn btn--ink" onClick={() => window.location.reload()}>
              <RotateCw aria-hidden="true" />重新加载
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
