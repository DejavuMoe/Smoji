import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { isEditing, ownsArrowKeys } from '../../keyboard'
import { useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useFocusReturn } from '../../focus-return'
import { EmojiImage } from '../gallery/EmojiImage'
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

  const actionRef = useRef<HTMLButtonElement | null>(null)
  const isOpen = Boolean(state.inspector.selectedSrc && activeInspectorItem)
  const item = activeInspectorItem?.item
  const isCustom = state.mode === 'custom'
  const isPicked = item ? activeGroupPickedSrcs.has(item.src) : false
  const sourcePack = item ? state.catalog.packs.find(pack => pack.items.some(entry => entry.src === item.src)) : undefined
  const isPackSelected = Boolean(sourcePack && state.packSelection.selectedPackIds.has(sourcePack.id))
  const isExcluded = item ? state.packSelection.excludedItemSrcs.has(item.src) : false
  const groups = state.customGroups.groups
  const activeGroupIndex = state.customGroups.activeGroupIndex

  // Escape/close must return focus to the card (or the gallery) that opened the inspector.
  const focusReturn = useFocusReturn()

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE_INSPECTOR' })
  }, [dispatch])

  const handlePrev = useCallback(() => {
    dispatch({ type: 'NAVIGATE_INSPECTOR', payload: 'prev' })
  }, [dispatch])

  const handleNext = useCallback(() => {
    dispatch({ type: 'NAVIGATE_INSPECTOR', payload: 'next' })
  }, [dispatch])

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey ||
      isEditing(e.target) || ownsArrowKeys(e.target)) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (e.key === 'ArrowLeft') handlePrev()
      else handleNext()
    }
  }

  if (!item || !activeInspectorItem) return null

  function handleActionClick() {
    if (!item) return
    if (isCustom) {
      dispatch({ type: 'TOGGLE_CUSTOM_ITEM', payload: item })
    } else if (sourcePack && !isPackSelected) {
      dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: sourcePack.id })
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
      <DialogContent {...focusReturn}
        onOpenAutoFocus={(event) => {
          focusReturn.onOpenAutoFocus(event)
          event.preventDefault()
          actionRef.current?.focus()
        }}
        onKeyDown={handleKeyDown}
        showCloseButton={false}
        className="max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-h-[92dvh] overflow-y-auto sm:max-w-[420px] gap-3 p-4 sm:p-5 sm:rounded-2xl"
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
          <Button variant="ghost"
            id="pop-close-btn"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="关闭详情"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Preview Area */}
        <div data-preview-stage className="relative mx-auto flex aspect-square w-[min(100%,16rem,40dvh)] items-center justify-center overflow-hidden rounded-xl border border-border/60">
          <div className={`absolute inset-0 ${bgStyle}`} />

          <Button variant="ghost"
            id="pop-prev-btn"
            type="button"
            className="absolute left-2 z-10 rounded-full bg-surface/80 p-1.5 text-muted-foreground shadow-xs backdrop-blur-xs hover:bg-surface hover:text-foreground"
            tooltip="上一个 (←)"
            aria-label="上一个表情"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <EmojiImage
            src={item.src}
            alt={item.label || item.id}
            retryable
            className="relative z-1 h-[70%] w-[70%]"
            imgClassName="max-h-full max-w-full object-contain"
          />

          <Button variant="ghost"
            id="pop-next-btn"
            type="button"
            className="absolute right-2 z-10 rounded-full bg-surface/80 p-1.5 text-muted-foreground shadow-xs backdrop-blur-xs hover:bg-surface hover:text-foreground"
            tooltip="下一个 (→)"
            aria-label="下一个表情"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Copy tabs */}
        <CopyTabs item={item} />

        {/* Background toggle */}
        <div className="pt-1">
          <PreviewBackgroundToggle />
        </div>

        {/* Target group selector: choose where add/remove applies without closing the dialog */}
        {isCustom && groups.length > 0 && (
          <div className="pt-2">
            <label htmlFor="pop-target-group" className="mb-1 block text-[11px] text-muted-foreground">
              目标自选分组
            </label>
            <Select value={String(activeGroupIndex)} onValueChange={(value) => {
              const index = Number(value)
              if (Number.isInteger(index) && groups[index]) dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: index })
            }}>
              <SelectTrigger id="pop-target-group" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                {groups.map((group, index) => (
                  <SelectItem key={group.id} value={String(index)}>{group.label}（{group.items.length} 张）</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
          </div>
        )}

        {/* Group / Pack action button */}
        <div className="pt-2">
          <Button variant="ghost"
            ref={actionRef}
            id="pop-group-btn"
            aria-keyshortcuts="Space"
            aria-describedby="pop-keyboard-hint"
            type="button"
            className={`w-full rounded-lg py-2 px-3 text-xs font-medium transition-colors truncate ${
              isCustom
                ? isPicked
                  ? 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                : !isPackSelected || isExcluded
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
            }`}
            onClick={handleActionClick}
          >
            {isCustom
              ? isPicked
                ? `从「${activeCustomGroup?.label ?? '分组'}」移出`
                : `加入「${activeCustomGroup?.label ?? '分组'}」`
              : !isPackSelected
                ? `选择「${sourcePack?.label ?? '当前分类'}」整包导出`
                : isExcluded
                ? '恢复到导出'
                : '从导出中排除'}
          </Button>
          <p id="pop-keyboard-hint" className="mt-2 text-center text-[11px] text-muted-foreground">
            空格执行当前选择操作 · ←/→ 翻图 · 1–5 选格式 · Esc 关闭
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
