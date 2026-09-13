import { useRef, useCallback, useEffect } from 'react'
import { FileCode, Download, AlertTriangle } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'
import { dockExportFormats, generateFormattedExport, stampDownloadFilename } from '../../export'
import { useDockOffset } from '../../hooks/use-dock-offset'
import { SMOJI_MANIFEST_MAX_BYTES } from '../../domain/limits'

export function ExportDock() {
  const {
    state,
    dispatch,
    exportPacks,
    exportItemCount,
    exportBytes,
    isOverBudget,
    manifestUrl,
  } = useWorkbench()

  const dockRef = useRef<HTMLDivElement | null>(null)
  const isCustom = state.mode === 'custom'

  // If in custom mode, we show dock if there's at least 1 custom group with items
  // In packs mode, we show dock if at least 1 pack is selected
  const hasItems = exportItemCount > 0
  const isVisible = hasItems || (isCustom ? state.customGroups.groups.some(g => g.items.length > 0) : state.packSelection.selectedPackIds.size > 0)

  useDockOffset(dockRef, isVisible)

  const formats = dockExportFormats()
  const currentFormat = state.export.format || 'smoji'

  const handleExport = useCallback(() => {
    if (!hasItems || isOverBudget) return
    try {
      const res = generateFormattedExport(currentFormat, exportPacks as any, manifestUrl)
      const mime = currentFormat === 'markdown' ? 'text/markdown' : 'application/json'
      const blob = new Blob([res.content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = stampDownloadFilename(res.filename)
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || '导出失败')
    }
  }, [hasItems, isOverBudget, currentFormat, exportPacks, manifestUrl])

  // Global Ctrl/Cmd+E export shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        const isInput =
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        if (isInput) return
        e.preventDefault()
        handleExport()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleExport])

  if (!isVisible) return null

  const budgetPercent = Math.min(100, Math.round((exportBytes / SMOJI_MANIFEST_MAX_BYTES) * 100))
  const kb = Math.round(exportBytes / 1024)

  return (
    <div
      ref={dockRef}
      id="selection-dock"
      role="region"
      aria-label="导出状态"
      aria-describedby="selection-dock-count selection-dock-hint"
      className="selection-dock fixed bottom-3 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-2 rounded-2xl border border-border/80 bg-surface/95 p-3 shadow-lg backdrop-blur-md transition-all sm:flex-row sm:items-center sm:justify-between sm:p-3.5"
    >
      {/* Selection Info */}
      <div className="selection-dock__info flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            id="selection-dock-count"
            className="selection-dock__count text-xs font-semibold text-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {exportPacks.length} 个{isCustom ? '自选组' : '分类'} · {exportItemCount} 张表情
          </span>
          {exportBytes > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              ({kb} KB)
            </span>
          )}
          {isOverBudget && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span>超出 1MB 限制</span>
            </span>
          )}
        </div>
        <span id="selection-dock-hint" className="selection-dock__hint truncate text-[11px] text-muted-foreground">
          {isOverBudget
            ? '配置数据超出最大 1MB 限制，请精简表情数量'
            : isCustom
              ? '可导出为各评论系统所用的表情配置'
              : '已排除分类中未选中的表情项'}
        </span>

        {/* Meter bar */}
        <div
          id="selection-dock-meter"
          className="selection-dock__meter mt-1 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={budgetPercent}
        >
          <div
            id="selection-dock-meter-bar"
            className={`selection-dock__meter-bar h-full transition-all ${
              isOverBudget ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="selection-dock__actions flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
        <div className="selection-dock__format-wrap relative min-w-0 flex-1 sm:flex-initial">
          <span className="sr-only">导出格式</span>
          <select
            id="selection-dock-format"
            className="selection-dock__format h-8 w-full sm:w-auto rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            aria-label="导出格式"
            value={currentFormat}
            onChange={(e) => dispatch({ type: 'SET_EXPORT_FORMAT', payload: e.target.value })}
          >
            {formats.map((fmt) => (
              <option key={fmt.id} value={fmt.id}>
                {fmt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          id="selection-dock-preview"
          type="button"
          className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-muted"
          title="预览导出数据 (⌘/Ctrl+Shift+P)"
          aria-keyshortcuts="Control+Shift+P Meta+Shift+P"
          onClick={() => dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: true })}
        >
          <FileCode className="h-3.5 w-3.5" />
          <span>预览</span>
        </button>

        <button
          id="selection-dock-export"
          type="button"
          className="btn-primary inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          title="导出当前配置 (⌘/Ctrl+E)"
          aria-keyshortcuts="Control+E Meta+E"
          disabled={!hasItems || isOverBudget}
          onClick={handleExport}
        >
          <Download className="h-3.5 w-3.5" />
          <span>导出</span>
        </button>
      </div>
    </div>
  )
}
