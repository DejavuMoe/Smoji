import { useCallback } from 'react'
import { AlertTriangle, Download, FileCode2 } from 'lucide-react'
import { useWorkbench } from '../app/WorkbenchContext'
import { SMOJI_MANIFEST_MAX_BYTES } from '../domain/limits'
import { dockExportFormats, listExportFormats, stampDownloadFilename } from '../export'
import { Segmented, Tip } from '../ui/primitives'
import { downloadText, formatBytes } from '../lib/actions'

export function useExportDownload() {
  const { exportItemCount, exportContent, exportFilename, exportError, isOverBudget } = useWorkbench()
  const canExport = exportItemCount > 0 && !isOverBudget && !exportError && Boolean(exportContent)
  const download = useCallback(() => {
    if (canExport) downloadText(stampDownloadFilename(exportFilename), exportContent)
  }, [canExport, exportContent, exportFilename])
  return { canExport, download }
}

export function ExportBar() {
  const { state, dispatch, exportPacks, exportItemCount, exportBytes, exportFilename, exportError, isOverBudget } = useWorkbench()
  const { canExport, download } = useExportDownload()
  const isCustom = state.mode === 'custom'
  const formats = dockExportFormats()
  const current = state.export.format || 'smoji'
  const extra = formats.some((format) => format.id === current) ? null : listExportFormats().find((format) => format.id === current)
  const options = [...formats, ...(extra ? [extra] : [])].map((format) => ({ value: format.id, label: format.label }))
  const percent = Math.min(100, (exportBytes / SMOJI_MANIFEST_MAX_BYTES) * 100)
  const kb = Math.round(exportBytes / 1024)
  const empty = exportItemCount === 0

  return (
    <div id="selection-dock" className="xbar" role="region" aria-label="导出状态" data-empty={empty || undefined}
      data-over={isOverBudget || Boolean(exportError) || undefined}>
      <div className="xbar__sum">
        <span id="selection-dock-count" className="xbar__count" aria-live="polite" aria-atomic="true">
          {exportPacks.length} 个{isCustom ? '自选组' : '分类'} · {exportItemCount} 张表情
        </span>
        <span className="xbar__bytes">{empty ? '—' : formatBytes(exportBytes)}</span>
        {!empty && exportFilename && <span className="xbar__file">{stampDownloadFilename(exportFilename)}</span>}
      </div>
      <div className="meter" role="progressbar" aria-label="导出数据体积" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(percent)} aria-valuetext={`${kb} KB / 1024 KB`}>
        <span className="meter__fill" style={{ width: `${percent}%` }} />
        <span className="meter__ticks" aria-hidden="true" />
      </div>
      {(isOverBudget || exportError) && (
        <p className="xbar__error" role="alert">
          <AlertTriangle aria-hidden="true" />
          {exportError ?? '超出 1MB 限制'}
        </p>
      )}
      <Segmented id="selection-dock-format" label="导出格式" className="xbar__formats" value={current} options={options}
        onChange={(value) => dispatch({ type: 'SET_EXPORT_FORMAT', payload: value })} />
      <div className="xbar__actions">
        <Tip label="预览导出数据 (⌘/Ctrl+Shift+P)">
          <button id="selection-dock-preview" type="button" className="btn btn--ghost" aria-keyshortcuts="Control+Shift+P Meta+Shift+P"
            onClick={() => dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: true })}>
            <FileCode2 aria-hidden="true" />预览
          </button>
        </Tip>
        <Tip label={canExport ? '导出当前配置 (⌘/Ctrl+E)' : undefined}>
          <button id="selection-dock-export" type="button" className="btn btn--ink xbar__export" aria-keyshortcuts="Control+E Meta+E"
            disabled={!canExport} onClick={download}>
            <Download aria-hidden="true" />导出
          </button>
        </Tip>
      </div>
    </div>
  )
}
