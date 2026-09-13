import { useState, useMemo, useCallback, useEffect } from 'react'
import { Download, Copy, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useWorkbench } from '../../app/WorkbenchContext'
import {
  generateFormattedExport,
  stampDownloadFilename,
  toExportItemSrc,
} from '../../export'
import type { PreviewScope } from '../../domain/state'
import type { SmojiPack } from '../../../../../packages/smoji/src/types'

const CODE_TABS = [
  { id: 'smoji', label: 'Smoji', filename: 'smoji.json' },
  { id: 'twikoo', label: 'Twikoo', filename: 'twikoo.json' },
  { id: 'owo', label: 'OwO', filename: 'OwO.json' },
  { id: 'artalk', label: 'Artalk', filename: 'artalk.json' },
  { id: 'markdown', label: 'Markdown', filename: 'smoji-markers.md' },
]

export function CodePreviewDialog() {
  const { state, dispatch, activePack, activeCustomGroup, manifestUrl } = useWorkbench()
  const isOpen = state.export.codeDialogOpen

  const [activeFormat, setActiveFormat] = useState(state.export.format || 'smoji')
  useEffect(() => {
    if (isOpen) setActiveFormat(state.export.format || 'smoji')
  }, [isOpen, state.export.format])
  const [scope, setScope] = useState<PreviewScope>(state.export.previewScope || 'selected')
  const [copied, setCopied] = useState(false)

  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: false })
  }, [dispatch])

  // Compute packs to export based on scope
  const packsForPreview = useMemo(() => {
    if (state.mode === 'packs') {
      if (scope === 'all') {
        return state.catalog.packs
      } else if (scope === 'current') {
        return activePack ? [activePack] : []
      } else {
        // selected
        return state.catalog.packs
          .filter((p) => state.packSelection.selectedPackIds.has(p.id))
          .map((p) => ({
            ...p,
            items: p.items.filter((i) => !state.packSelection.excludedItemSrcs.has(i.src)),
          }))
          .filter((p) => p.items.length > 0)
      }
    } else {
      // custom mode
      if (scope === 'current') {
        return activeCustomGroup && activeCustomGroup.items.length > 0 ? [activeCustomGroup] : []
      } else {
        return state.customGroups.groups.filter((g) => g.items.length > 0)
      }
    }
  }, [state, scope, activePack, activeCustomGroup])

  const exportResult = useMemo(() => {
    if (packsForPreview.length === 0) {
      return {
        content: '{\n  "error": "当前范围内无选中的表情"\n}',
        filename: 'smoji.json',
      }
    }
    try {
      return generateFormattedExport(activeFormat, packsForPreview as any, manifestUrl)
    } catch (err: any) {
      return {
        content: `{\n  "error": ${JSON.stringify(err.message || '导出失败')}\n}`,
        filename: `${activeFormat}.json`,
      }
    }
  }, [activeFormat, packsForPreview, manifestUrl])

  const stampedName = useMemo(() => {
    return stampDownloadFilename(exportResult.filename)
  }, [exportResult.filename])

  const handleDownload = useCallback(() => {
    const mime = activeFormat === 'markdown' ? 'text/markdown' : 'application/json'
    const blob = new Blob([exportResult.content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = stampedName
    a.click()
    URL.revokeObjectURL(url)
  }, [exportResult.content, stampedName, activeFormat])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportResult.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [exportResult.content])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent id="code-modal" className="max-w-2xl p-5 sm:rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-sm font-semibold text-foreground">
              数据预览与导出
            </DialogTitle>
            <div id="code-modal-meta" className="text-xs text-muted-foreground">
              {stampedName} ({packsForPreview.length} 个分组 · {exportResult.content.length} 字节)
            </div>
          </div>
          <button
            id="code-modal-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="关闭预览"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Format tabs and Scope selector */}
        <div className="my-2 flex flex-wrap items-center justify-between gap-2">
          {/* Format Tabs */}
          <div className="flex overflow-x-auto rounded-lg bg-muted p-0.5 text-xs">
            {CODE_TABS.map((tab) => {
              const isSelected = activeFormat === tab.id
              return (
                <button
                  key={tab.id}
                  id={`code-tab-${tab.id}`}
                  type="button"
                  aria-selected={isSelected}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    isSelected
                      ? 'bg-surface text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveFormat(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Scope Selector */}
          <div className="flex rounded-lg bg-muted p-0.5 text-xs">
            {(['selected', 'all', 'current'] as PreviewScope[]).map((s) => (
              <button
                key={s}
                type="button"
                data-scope={s}
                aria-checked={scope === s}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  scope === s
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setScope(s)}
              >
                {s === 'selected' ? '已选择' : s === 'all' ? '全部' : '当前'}
              </button>
            ))}
          </div>
        </div>

        {/* Code Content */}
        <pre className="max-h-[380px] overflow-auto rounded-xl border border-border/80 bg-muted/40 p-3 font-mono text-[11px] text-foreground">
          <code id="code-preview-content">{exportResult.content}</code>
        </pre>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied ? '已复制' : '复制内容'}</span>
          </button>

          <button
            id="btn-download-current-code"
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            <span>下载文件</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
