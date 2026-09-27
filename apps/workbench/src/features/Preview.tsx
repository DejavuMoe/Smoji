import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { AlertTriangle, Check, Copy, Download, X } from 'lucide-react'
import { useWorkbench } from '../app/WorkbenchContext'
import { useFocusReturn } from '../focus-return'
import type { PreviewScope } from '../domain/state'
import { exportErrorMessage, generateFormattedExport, previewExportFormats, stampDownloadFilename } from '../export'
import { Segmented } from '../ui/primitives'
import { downloadText, writeClipboard } from '../lib/actions'

/** Keys, strings and literals in three quiet tones; plain text past the budget keeps huge manifests responsive. */
function highlight(content: string) {
  if (content.length > 160_000) return content
  const out: ReactNode[] = []
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g
  let last = 0
  let key = 0
  for (const match of content.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) out.push(content.slice(last, at))
    if (match[1]) {
      out.push(<span key={key++} className={match[2] ? 'tok-key' : 'tok-str'}>{match[1]}</span>)
      if (match[2]) out.push(match[2])
    } else {
      out.push(<span key={key++} className="tok-lit">{match[0]}</span>)
    }
    last = at + match[0].length
  }
  if (last < content.length) out.push(content.slice(last))
  return out
}

export function Preview() {
  const { state, dispatch, activePack, activeCustomGroup, manifestUrl } = useWorkbench()
  const focusReturn = useFocusReturn('#selection-dock-preview, #grid')
  const codeRef = useRef<HTMLElement | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const tabs = useMemo(() => previewExportFormats(), [])
  const format = tabs.some((tab) => tab.id === state.export.format) ? state.export.format : tabs[0]?.id ?? 'smoji'

  useEffect(() => {
    if (state.export.format !== format) dispatch({ type: 'SET_EXPORT_FORMAT', payload: format })
  }, [state.export.format, format, dispatch])

  const scopes: { value: PreviewScope; label: string }[] = state.mode === 'packs'
    ? [{ value: 'selected', label: '已选择' }, { value: 'all', label: '全部' }, { value: 'current', label: '当前' }]
    : [{ value: 'selected', label: '全部自选分组' }, { value: 'current', label: '当前分组' }]
  const raw = state.export.previewScope
  const scope: PreviewScope = scopes.some((option) => option.value === raw) ? raw : raw === 'all' ? 'selected' : scopes[0]!.value

  const packs = useMemo(() => {
    const kept = <T extends { items: readonly { src: string }[] }>(pack: T): T =>
      ({ ...pack, items: pack.items.filter((item) => !state.packSelection.excludedItemSrcs.has(item.src)) })
    if (state.mode === 'packs') {
      if (scope === 'all') return state.catalog.packs
      if (scope === 'current') return activePack ? [kept(activePack)] : []
      return state.catalog.packs.filter((pack) => state.packSelection.selectedPackIds.has(pack.id)).map(kept).filter((pack) => pack.items.length)
    }
    if (scope === 'current') return activeCustomGroup?.items.length ? [activeCustomGroup] : []
    return state.customGroups.groups.filter((group) => group.items.length)
  }, [state, scope, activePack, activeCustomGroup])

  const preview = useMemo(() => {
    if (!packs.length) {
      return {
        content: '', filename: '', bytes: 0,
        error: state.mode === 'packs'
          ? '当前范围内没有可导出的表情。请先勾选分类，或切换到「全部 / 当前」范围。'
          : '当前范围内没有可导出的表情。请先向自选分组添加表情。',
      }
    }
    try {
      const generated = generateFormattedExport(format, packs as never, manifestUrl)
      return { ...generated, bytes: new TextEncoder().encode(generated.content).length, error: null as string | null }
    } catch (error) {
      return { content: '', filename: '', bytes: 0, error: exportErrorMessage(error) }
    }
  }, [format, packs, manifestUrl, state.mode])

  const filename = preview.filename ? stampDownloadFilename(preview.filename) : ''
  const lines = preview.content ? preview.content.split('\n').length - (preview.content.endsWith('\n') ? 1 : 0) : 0
  const tokens = useMemo(() => highlight(preview.content), [preview.content])

  const onCopy = useCallback(async () => {
    if (preview.error || !preview.content) return
    if (await writeClipboard(preview.content)) setCopied('已复制')
    else {
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
    window.setTimeout(() => setCopied(null), 3000)
  }, [preview.content, preview.error])

  const close = () => dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: false })

  return (
    <Dialog.Root open={state.export.codeDialogOpen} onOpenChange={(open) => { if (!open) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ov" />
        <Dialog.Content id="code-modal" className="dlg pv" aria-describedby="code-modal-meta" {...focusReturn}>
          <header className="pv__head">
            <div className="pv__titles">
              <Dialog.Title className="dlg__title">数据预览与导出</Dialog.Title>
              <p id="code-modal-meta" className="pv__meta">
                {preview.error ? '当前范围无法导出' : <><span className="mono">{filename}</span> · {packs.length} 个分组 · {preview.bytes.toLocaleString('zh-CN')} 字节</>}
              </p>
            </div>
            <Dialog.Close id="code-modal-close" className="icon-btn" aria-label="关闭预览"><X aria-hidden="true" /></Dialog.Close>
          </header>

          <div className="pv__bar">
            <Segmented label="导出格式" value={format} onChange={(value) => dispatch({ type: 'SET_EXPORT_FORMAT', payload: value })}
              options={tabs.map((tab) => ({ value: tab.id, label: tab.label, id: `code-tab-${tab.id}` }))} />
            <Segmented label="导出范围" value={scope} onChange={(value) => dispatch({ type: 'SET_EXPORT_PREVIEW_SCOPE', payload: value })}
              options={scopes.map((option) => ({ ...option, id: `code-scope-${option.value}` }))} />
          </div>

          {preview.error ? (
            <div id="code-preview-error" className="pv__error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div>
                <p>{preview.error}</p>
                <p className="pv__error-hint">可调整上方范围或格式后重试。</p>
              </div>
            </div>
          ) : (
            <div className="pv__code" key={`${format}:${scope}`} data-lines={String(lines).length}>
              <pre><code ref={codeRef} id="code-preview-content">{tokens}</code></pre>
            </div>
          )}

          <footer className="pv__foot">
            <span className="pv__lines">{preview.error ? '' : `${lines.toLocaleString('zh-CN')} 行`}</span>
            <div className="pv__actions">
              <button id="code-preview-copy" type="button" className="btn btn--ghost" disabled={Boolean(preview.error)} onClick={onCopy}>
                {copied === '已复制' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied?.startsWith('复制失败') ? '手动复制' : copied ?? '复制内容'}
              </button>
              <button id="btn-download-current-code" type="button" className="btn btn--ink" disabled={Boolean(preview.error)}
                onClick={() => { if (!preview.error && preview.content) downloadText(filename, preview.content) }}>
                <Download aria-hidden="true" />下载文件
              </button>
            </div>
          </footer>
          {copied && (
            <div role="status" aria-live="polite" aria-atomic="true" className={copied.startsWith('复制失败') ? 'pv__status' : 'sr-only'}>{copied}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
