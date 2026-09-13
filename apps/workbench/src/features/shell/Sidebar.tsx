import { useWorkbench } from '../../app/WorkbenchContext'
import { PackList } from '../packs/PackList'
import { CustomGroupList } from '../custom-groups/CustomGroupList'

export function SidebarContent() {
  const { state, dispatch } = useWorkbench()
  const mode = state.mode

  return (
    <div className="flex h-full flex-col">
      {/* Mode Tabs */}
      <div className="mode-tabs mb-3 flex rounded-lg bg-muted p-1">
        <button
          id="tab-packs"
          type="button"
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
            mode === 'packs'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'packs' })}
        >
          按分类导出
        </button>
        <button
          id="tab-custom"
          type="button"
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
            mode === 'custom'
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'custom' })}
        >
          自选分组
        </button>
      </div>

      {/* Mode Body */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'packs' ? <PackList /> : <CustomGroupList />}
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside
      id="sidebar"
      className="hidden h-[calc(100dvh-3.5rem)] w-[240px] shrink-0 flex-col border-r border-border bg-surface/50 p-3 md:flex lg:w-[272px]"
      aria-label="侧边栏工作区"
    >
      <SidebarContent />
    </aside>
  )
}
