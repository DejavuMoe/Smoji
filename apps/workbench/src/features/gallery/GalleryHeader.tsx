import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { Button } from '../../components/ui/button'
import { LayoutGrid } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'

export function GalleryHeader() {
  const {
    state,
    dispatch,
    activePack,
    activeCustomGroup,
    currentPackExcludedCount,
    currentPackAllExcluded,
  } = useWorkbench()

  const isCustom = state.mode === 'custom'
  const isComfortable = state.gallery.density === 'comfortable'
  const isPickedView = state.gallery.view === 'picked'

  function toggleDensity() {
    dispatch({
      type: 'SET_GALLERY_DENSITY',
      payload: isComfortable ? 'compact' : 'comfortable',
    })
  }

  return (
    <div className="gallery__header sticky top-0 z-10 shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
          {isCustom && isPickedView
            ? activeCustomGroup?.label ?? '已入组表情'
            : activePack?.label ?? '表情'}
        </h2>
        <div id="gallery-export-count" className="text-xs text-muted-foreground truncate">
          {isCustom ? (
            activeCustomGroup ? (
              <span className="truncate">
                添加到「{activeCustomGroup.label}」 · 当前分组 {activeCustomGroup.items.length} 张
              </span>
            ) : (
              <span>自选分组未激活</span>
            )
          ) : (
            <span>
              {activePack?.items.length ?? 0} 张
              {currentPackExcludedCount > 0 ? ` · 已排除 ${currentPackExcludedCount} 张` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
        {/* Custom view toggle: [当前分类] [已入组] */}
        {isCustom && (
          <ToggleGroup className="shrink-0" id="gallery-view-picked" aria-label="图库范围" value={isPickedView ? 'picked' : 'source'}
            onValueChange={(value) => dispatch({ type: 'SET_GALLERY_VIEW', payload: value as 'picked' | 'source' })}>
            <ToggleGroupItem value="source">当前分类</ToggleGroupItem>
            <ToggleGroupItem value="picked">已入组 ({activeCustomGroup?.items.length ?? 0})</ToggleGroupItem>
          </ToggleGroup>
        )}

        {!isCustom && activePack && (
          <Button variant="ghost"
            type="button"
            aria-pressed={state.packSelection.selectedPackIds.has(activePack.id)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: activePack.id })}
          >
            {state.packSelection.selectedPackIds.has(activePack.id) ? '取消选择本分类' : '选择本分类导出'}
          </Button>
        )}

        {/* Batch action button */}
        {!isCustom ? (
          <Button variant="ghost"
            id="btn-batch-pack-action"
            type="button"
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            onClick={() =>
              dispatch({
                type: currentPackAllExcluded
                  ? 'RESTORE_CURRENT_PACK_ALL'
                  : 'EXCLUDE_CURRENT_PACK_ALL',
              })
            }
          >
            {currentPackAllExcluded ? '恢复本分类全部' : '排除本分类全部'}
          </Button>
        ) : (
          !isPickedView && (
            <Button variant="ghost"
              id="btn-batch-pack-action"
              type="button"
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              onClick={() => dispatch({ type: 'ADD_ALL_CURRENT_PACK_TO_CUSTOM' })}
            >
              本分类全部加入
            </Button>
          )
        )}

        {/* Density toggle: 紧凑 / 舒适 */}
        <Button variant="ghost"
          id="density-toggle"
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          tooltip={`当前密度：${isComfortable ? '舒适' : '紧凑'}`}
          aria-label={`切换显示密度，当前为${isComfortable ? '舒适' : '紧凑'}`}
          onClick={toggleDensity}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>{isComfortable ? '舒适' : '紧凑'}</span>
        </Button>
      </div>
    </div>
  )
}
