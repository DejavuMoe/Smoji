import { Button } from '../components/ui/button'
import React, { Component, type ErrorInfo, type ReactNode } from 'react'

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
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-foreground">
            <h1 className="text-lg font-semibold text-destructive">工作台加载遇到问题</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || '发生了意外错误，已保护您的本地数据。'}
            </p>
            <Button variant="ghost"
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              重新加载
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
