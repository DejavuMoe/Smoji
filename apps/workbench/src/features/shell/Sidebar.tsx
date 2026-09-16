import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { useWorkbench } from '../../app/WorkbenchContext'
import { PackList } from '../packs/PackList'
import { CustomGroupList } from '../custom-groups/CustomGroupList'
import { useMediaQuery } from '../../hooks/use-media-query'

export function SidebarContent() {
  const { state, dispatch } = useWorkbench()
  const mode = state.mode

  return (
    <div className="flex h-full min-w-0 flex-col min-h-0">
      {/* Mode Tabs */}
      <ToggleGroup aria-label="工作模式" className="mode-tabs mb-3 flex shrink-0" value={mode}
        onValueChange={(value) => dispatch({ type: 'SET_MODE', payload: value as 'packs' | 'custom' })}>
        <ToggleGroupItem id="tab-packs" value="packs">按分类导出</ToggleGroupItem>
        <ToggleGroupItem id="tab-custom" value="custom">自选分组</ToggleGroupItem>
      </ToggleGroup>

      {/* Mode Body */}
      <div className="sidebar-scroll flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] space-y-4 pb-[var(--selection-dock-offset)]">
        {mode === 'custom' && <CustomGroupList />}
        <PackList />
      </div>
    </div>
  )
}

export function Sidebar() {
  const isDesktop = useMediaQuery('(min-width: 901px)')

  return (
    <aside
      id="sidebar"
      className="hidden min-h-0 min-[901px]:flex w-[240px] shrink-0 flex-col border-r border-border bg-surface/50 p-3 min-[1100px]:w-[272px]"
      aria-label="侧边栏工作区"
    >
      {isDesktop && <SidebarContent />}
    </aside>
  )
}
