import { LayoutGrid, CheckSquare } from 'lucide-react'
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
    <div className="gallery__header flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {isCustom && isPickedView
            ? activeCustomGroup?.label ?? '已入组表情'
            : activePack?.label ?? '表情'}
        </h2>
        <div id="gallery-export-count" className="text-xs text-muted-foreground">
          {isCustom ? (
            activeCustomGroup ? (
              <span>
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

      <div className="flex items-center gap-2">
        {/* Custom view toggle: [当前分类] [已入组] */}
        {isCustom && (
          <div id="gallery-view-picked" className="flex rounded-lg bg-muted p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                !isPickedView ? 'bg-surface text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })}
            >
              当前分类
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                isPickedView ? 'bg-surface text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => dispatch({ type: 'SET_GALLERY_VIEW', payload: 'picked' })}
            >
              已入组 ({activeCustomGroup?.items.length ?? 0})
            </button>
          </div>
        )}

        {/* Batch action button */}
        {!isCustom ? (
          <button
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
          </button>
        ) : (
          !isPickedView && (
            <button
              id="btn-batch-pack-action"
              type="button"
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              onClick={() => dispatch({ type: 'ADD_ALL_CURRENT_PACK_TO_CUSTOM' })}
            >
              本分类全部加入
            </button>
          )
        )}

        {/* Density toggle: 紧凑 / 舒适 */}
        <button
          id="density-toggle"
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          title={`当前密度：${isComfortable ? '舒适' : '紧凑'}`}
          aria-label={`切换显示密度，当前为${isComfortable ? '舒适' : '紧凑'}`}
          onClick={toggleDensity}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>{isComfortable ? '舒适' : '紧凑'}</span>
        </button>
      </div>
    </div>
  )
}
