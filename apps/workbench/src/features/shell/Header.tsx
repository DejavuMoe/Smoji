import { Menu, Code2, HelpCircle, Undo2, Redo2 } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const { state, dispatch, mobileDrawerOpen, setMobileDrawerOpen, canUndo, canRedo } = useWorkbench()

  return (
    <header className="top sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface/95 px-3 sm:px-6 backdrop-blur-sm">
      <div className="top__left min-w-0 shrink-0 flex items-center gap-2 sm:gap-3">
        <a className="brand shrink-0 flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90" href="/" aria-label="Smoji 首页">
          <img className="brand__mark h-7 w-7 shrink-0" src="/favicon.svg?v=2" width="28" height="28" alt="" />
          <div className="brand__title-group flex items-baseline gap-2">
            <span className="brand__text shrink-0 font-mono text-base font-semibold tracking-tight text-foreground">Smoji</span>
            <span className="brand__description hidden text-xs text-muted-foreground lg:inline">表情工作台</span>
          </div>
        </a>
      </div>

      <div className="top__actions shrink-0 flex items-center gap-1 sm:gap-2">
        {/* Mobile menu toggle */}
        <button
          id="menu-toggle"
          type="button"
          className="menu-toggle shrink-0 whitespace-nowrap inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted min-[901px]:hidden"
          aria-expanded={mobileDrawerOpen}
          aria-controls="sidebar"
          aria-label="打开侧边栏菜单"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        >
          <Menu className="h-4 w-4" />
          <span>分类</span>
        </button>

        {/* Undo / Redo - visible on sm+ screens */}
        <div className="hidden sm:flex items-center shrink-0">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            title="撤销 (⌘/Ctrl+Z)"
            aria-label="撤销"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            title="重做 (⌘/Ctrl+Shift+Z)"
            aria-label="重做"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'REDO' })}
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {/* Code Preview */}
        <button
          id="btn-open-code"
          type="button"
          className="btn-ghost shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="预览导出数据 (⌘/Ctrl+Shift+P)"
          onClick={() => dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: true })}
        >
          <Code2 className="h-4 w-4" />
          <span className="hidden sm:inline">数据预览</span>
        </button>

        {/* Guide / Help */}
        <button
          id="btn-open-guide"
          type="button"
          className="btn-ghost shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="查看接入说明与规范"
          onClick={() => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: true })}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">帮助</span>
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  )
}
