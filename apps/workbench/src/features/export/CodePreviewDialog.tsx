import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { Button } from '../../components/ui/button'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Download, Copy, X, AlertTriangle, MousePointerClick } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useWorkbench } from '../../app/WorkbenchContext'
import {
  exportErrorMessage,
  generateFormattedExport,
  previewExportFormats,
  stampDownloadFilename,
} from '../../export'
import { useFocusReturn } from '../../focus-return'
import type { PreviewScope } from '../../domain/state'

interface ScopeOption {
  id: PreviewScope
  label: string
}

export function CodePreviewDialog() {
  const { state, dispatch, activePack, activeCustomGroup, manifestUrl } = useWorkbench()
  const isOpen = state.export.codeDialogOpen
  const [copied, setCopied] = useState<string | null>(null)
  const codeRef = useRef<HTMLElement | null>(null)

  const focusReturn = useFocusReturn('#btn-open-code')

  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: false })
  }, [dispatch])

  // One registry drives dock and preview; the selected format lives in global state.
  const tabs = useMemo(() => previewExportFormats(), [])
  const activeFormat = state.export.format && tabs.some((tab) => tab.id === state.export.format)
    ? state.export.format
    : tabs[0]?.id ?? 'smoji'

  // A removed format may still be selected in an already-open workbench during an update.
  useEffect(() => {
    if (state.export.format !== activeFormat) dispatch({ type: 'SET_EXPORT_FORMAT', payload: activeFormat })
  }, [state.export.format, activeFormat, dispatch])

  const scopeOptions: ScopeOption[] = state.mode === 'packs'
    ? [
        { id: 'selected', label: '已选择' },
        { id: 'all', label: '全部' },
        { id: 'current', label: '当前' },
      ]
    : [
        { id: 'selected', label: '全部自选分组' },
        { id: 'current', label: '当前分组' },
      ]
  // Custom mode has no separate "all": keep one clear meaning for the stored scope.
  const rawScope = state.export.previewScope
  const scope: PreviewScope =
    scopeOptions.some((option) => option.id === rawScope)
      ? rawScope
      : rawScope === 'all'
        ? 'selected'
        : scopeOptions[0]!.id

  // Compute packs to export based on scope; exclusions always apply to concrete selections.
  const packsForPreview = useMemo(() => {
    const withoutExcluded = <T extends { items: readonly { src: string }[] }>(pack: T): T => ({
      ...pack,
      items: pack.items.filter((i) => !state.packSelection.excludedItemSrcs.has(i.src)),
    })
    if (state.mode === 'packs') {
      if (scope === 'all') return state.catalog.packs
      if (scope === 'current') return activePack ? [withoutExcluded(activePack)] : []
      return state.catalog.packs
        .filter((p) => state.packSelection.selectedPackIds.has(p.id))
        .map(withoutExcluded)
        .filter((p) => p.items.length > 0)
    }
    if (scope === 'current') {
      return activeCustomGroup && activeCustomGroup.items.length > 0 ? [activeCustomGroup] : []
    }
    return state.customGroups.groups.filter((g) => g.items.length > 0)
  }, [state, scope, activePack, activeCustomGroup])

  /** Errors stay errors: never wrap a failure message as a downloadable configuration. */
  const preview = useMemo(() => {
    if (packsForPreview.length === 0) {
      return {
        content: '',
        filename: '',
        bytes: 0,
        error:
          state.mode === 'packs'
            ? '当前范围内没有可导出的表情。请先勾选分类，或切换到「全部 / 当前」范围。'
            : '当前范围内没有可导出的表情。请先向自选分组添加表情。',
      }
    }
    try {
      const generated = generateFormattedExport(activeFormat, packsForPreview as any, manifestUrl)
      return {
        content: generated.content,
        filename: generated.filename,
        bytes: new TextEncoder().encode(generated.content).length,
        error: null as string | null,
      }
    } catch (err) {
      return {
        content: '',
        filename: '',
        bytes: 0,
        error: exportErrorMessage(err),
      }
    }
  }, [activeFormat, packsForPreview, manifestUrl, state.mode])

  const stampedName = preview.filename ? stampDownloadFilename(preview.filename) : ''

  const handleDownload = useCallback(() => {
    if (preview.error || !preview.content) return
    const mime = preview.filename.endsWith('.md') ? 'text/markdown;charset=utf-8' : 'application/json'
    const blob = new Blob([preview.content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = stampedName
    a.click()
    URL.revokeObjectURL(url)
  }, [preview.content, preview.error, preview.filename, stampedName])

  const handleCopy = useCallback(async () => {
    if (preview.error || !preview.content) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API not available')
      await navigator.clipboard.writeText(preview.content)
      setCopied('已复制')
    } catch {
      // Fallback: select the code so the user can copy it manually.
      const node = codeRef.current
      if (node) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      setCopied('复制失败，已选中内容，请按 ⌘/Ctrl+C 手动复制')
    }
    setTimeout(() => setCopied(null), 3000)
  }, [preview.content, preview.error])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent {...focusReturn} id="code-modal" showCloseButton={false} className="sm:max-w-2xl max-h-[min(90dvh,700px)] overflow-y-auto p-4 sm:p-5 sm:rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              数据预览与导出
            </DialogTitle>
            <div id="code-modal-meta" className="text-xs text-muted-foreground truncate">
              {preview.error
                ? '当前范围无法导出'
                : `${stampedName} (${packsForPreview.length} 个分组 · ${preview.bytes} 字节)`}
            </div>
          </div>
          <Button variant="ghost"
            id="code-modal-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="关闭预览"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Format tabs and Scope selector share one registry-backed Tabs root */}
        <Tabs
          value={activeFormat}
          onValueChange={(next) => dispatch({ type: 'SET_EXPORT_FORMAT', payload: next })}
          className="my-2 flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList aria-label="导出格式">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  id={`code-tab-${tab.id}`}
                  value={tab.id}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Scope Selector */}
            <ToggleGroup aria-label="导出范围" value={scope} onValueChange={(value) => dispatch({ type: 'SET_EXPORT_PREVIEW_SCOPE', payload: value as PreviewScope })}>
              {scopeOptions.map((option) => (
                <ToggleGroupItem key={option.id} value={option.id} data-scope={option.id}>{option.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Code Content / error state */}
          {preview.error ? (
            <div
              id="code-preview-error"
              role="alert"
              className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>{preview.error}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MousePointerClick className="h-3.5 w-3.5" />
                <span>可调整上方范围或格式后重试。</span>
              </span>
            </div>
          ) : (
            <TabsContent value={activeFormat}>
              <pre key={`${activeFormat}:${scope}`} className="max-h-[min(380px,55dvh)] overflow-auto rounded-xl border border-border/80 bg-muted/40 p-3 font-mono text-[11px] text-foreground">
                <code ref={codeRef} id="code-preview-content">{preview.content}</code>
              </pre>
            </TabsContent>
          )}
        </Tabs>

        {/* Actions */}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <Button variant="ghost"
            type="button"
            id="code-preview-copy"
            className="inline-flex min-w-28 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            disabled={Boolean(preview.error)}
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied?.startsWith('复制失败') ? '手动复制' : copied ?? '复制内容'}</span>
          </Button>

          <Button variant="ghost"
            id="btn-download-current-code"
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
            disabled={Boolean(preview.error)}
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            <span>下载文件</span>
          </Button>
        </div>

        {copied && (
          <div role="status" aria-live="polite" aria-atomic="true" className={copied.startsWith('复制失败') ? 'min-w-0 text-xs text-muted-foreground' : 'sr-only'}>
            {copied}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
