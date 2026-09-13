import { Moon, Sun, Monitor } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'
import type { Theme } from '../../domain/state'

export function ThemeToggle() {
  const { state, dispatch } = useWorkbench()
  const theme = state.preferences.theme

  function handleToggle() {
    const nextTheme: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    dispatch({ type: 'SET_THEME', payload: nextTheme })
  }

  const title =
    theme === 'dark' ? '当前：深色模式 (点击切换到跟随系统)' : theme === 'light' ? '当前：浅色模式 (点击切换到深色)' : '当前：跟随系统 (点击切换到浅色)'

  return (
    <button
      id="theme-toggle"
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={title}
      aria-label={title}
      onClick={handleToggle}
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </button>
  )
}
