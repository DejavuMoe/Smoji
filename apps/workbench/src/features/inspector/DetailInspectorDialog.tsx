import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useWorkbench } from '../../app/WorkbenchContext'
import { thumbnailSrc } from '../../images'
import { CopyTabs } from './CopyTabs'
import { PreviewBackgroundToggle } from './PreviewBackgroundToggle'

export function DetailInspectorDialog() {
  const {
    state,
    dispatch,
    activeInspectorItem,
    activeCustomGroup,
    activeGroupPickedSrcs,
  } = useWorkbench()

  const isOpen = Boolean(state.inspector.selectedSrc && activeInspectorItem)
  const item = activeInspectorItem?.item
  const isCustom = state.mode === 'custom'
  const isPicked = item ? activeGroupPickedSrcs.has(item.src) : false
  const isExcluded = item ? state.packSelection.excludedItemSrcs.has(item.src) : false

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE_INSPECTOR' })
  }, [dispatch])

  const handlePrev = useCallback(() => {
    dispatch({ type: 'NAVIGATE_INSPECTOR', payload: 'prev' })
  }, [dispatch])

  const handleNext = useCallback(() => {
    dispatch({ type: 'NAVIGATE_INSPECTOR', payload: 'next' })
  }, [dispatch])

  // ArrowLeft / ArrowRight navigation
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handlePrev, handleNext])

  if (!item || !activeInspectorItem) return null

  function handleActionClick() {
    if (!item) return
    if (isCustom) {
      dispatch({ type: 'TOGGLE_CUSTOM_ITEM', payload: item })
    } else {
      dispatch({ type: 'TOGGLE_PACK_ITEM_EXCLUSION', payload: item.src })
    }
  }

  const bgStyle =
    state.inspector.previewBackground === 'dark'
      ? 'bg-[#18181b]'
      : state.inspector.previewBackground === 'light'
        ? 'bg-[#ffffff]'
        : 'bg-checkerboard'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-h-[92dvh] overflow-y-auto sm:max-w-[420px] p-4 sm:p-5 sm:rounded-2xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              {item.label || item.id}
            </DialogTitle>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
              <span className="pop__badge rounded bg-muted px-1.5 py-0.5 font-medium truncate">
                {activeInspectorItem.packLabel}
              </span>
              <span>·</span>
              <span className="pop__badge rounded bg-muted px-1.5 py-0.5 font-mono shrink-0">
                {activeInspectorItem.format}
              </span>
            </div>
          </div>
          <button
            id="pop-close-btn"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="关闭详情"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Preview Area */}
        <div className="relative my-2 flex h-40 sm:h-48 w-full items-center justify-center rounded-xl border border-border/60 overflow-hidden">
          <div className={`absolute inset-0 ${bgStyle}`} />

          <button
            id="pop-prev-btn"
            type="button"
            className="absolute left-2 z-10 rounded-full bg-surface/80 p-1.5 text-muted-foreground shadow-xs backdrop-blur-xs hover:bg-surface hover:text-foreground"
            title="上一个 (←)"
            aria-label="上一个表情"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <img
            src={thumbnailSrc(item.src)}
            alt={item.label || item.id}
            className="relative z-1 max-h-36 max-w-36 object-contain pointer-events-none"
          />

          <button
            id="pop-next-btn"
            type="button"
            className="absolute right-2 z-10 rounded-full bg-surface/80 p-1.5 text-muted-foreground shadow-xs backdrop-blur-xs hover:bg-surface hover:text-foreground"
            title="下一个 (→)"
            aria-label="下一个表情"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Copy tabs */}
        <CopyTabs item={item} />

        {/* Background toggle */}
        <div className="pt-1">
          <PreviewBackgroundToggle />
        </div>

        {/* Group / Pack action button */}
        <div className="pt-2">
          <button
            id="pop-group-btn"
            type="button"
            className={`w-full rounded-lg py-2 px-3 text-xs font-medium transition-colors truncate ${
              isCustom
                ? isPicked
                  ? 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                : isExcluded
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
            }`}
            onClick={handleActionClick}
          >
            {isCustom
              ? isPicked
                ? `从「${activeCustomGroup?.label ?? '分组'}」移出`
                : `加入「${activeCustomGroup?.label ?? '分组'}」`
              : isExcluded
                ? '恢复到导出'
                : '从导出中排除'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
