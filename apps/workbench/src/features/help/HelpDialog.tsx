import { X, ExternalLink, Keyboard, Layers, FileJson } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useWorkbench } from '../../app/WorkbenchContext'
import { dockExportFormats, stampDownloadFilename } from '../../export'
import { SMOJI_MAX_PACKS, SMOJI_MAX_ITEMS_PER_PACK, SMOJI_MAX_ITEMS } from '../../domain/limits'

export function HelpDialog() {
  const { state, dispatch } = useWorkbench()
  const isOpen = state.export.helpDialogOpen

  const formats = dockExportFormats()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: open })}>
      <DialogContent id="guide-modal" showCloseButton={false} className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6 sm:rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
          <DialogTitle className="text-sm sm:text-base font-semibold text-foreground truncate min-w-0 flex-1">
            Smoji 使用指南与接入规范
          </DialogTitle>
          <button
            id="guide-modal-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="关闭使用指南"
            onClick={() => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: false })}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="space-y-6 pt-2 text-xs text-foreground">
          {/* Quick Start */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              <span>快速开始</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <h4 className="font-medium text-foreground">按分类导出 (Packs Mode)</h4>
                <p className="mt-1 text-muted-foreground">
                  直接勾选完整分类，快速导出分类内全部表情包。点击表情卡片可预览或单张复制。
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <h4 className="font-medium text-foreground">自选分组 (Custom Groups)</h4>
                <p className="mt-1 text-muted-foreground">
                  自由创建个人专属表情组，跨分类添加、排序、拆分和合并。支持本地离线持久化与导入备份。
                </p>
              </div>
            </div>
          </section>

          {/* Keyboard shortcuts */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
              <Keyboard className="h-4 w-4 text-primary" />
              <span>常用快捷键</span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 font-mono">
                <span className="text-muted-foreground font-sans">撤销 / 重做</span>
                <span>⌘/Ctrl+Z / ⌘/Ctrl+Shift+Z</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 font-mono">
                <span className="text-muted-foreground font-sans">预览导出数据</span>
                <span>⌘/Ctrl+Shift+P</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 font-mono">
                <span className="text-muted-foreground font-sans">导出当前配置</span>
                <span>⌘/Ctrl+E</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 font-mono">
                <span className="text-muted-foreground font-sans">详情切换格式</span>
                <span>数字键 1 ~ 5</span>
              </div>
            </div>
          </section>

          {/* Advanced specifications & Limits */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileJson className="h-4 w-4 text-primary" />
              <span>数据规范与容量限制</span>
            </h3>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                单次最多分类：<strong data-guide-limit="packs-n" className="font-semibold text-foreground">{SMOJI_MAX_PACKS}</strong> 组
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                每组上限：<strong className="font-semibold text-foreground">{SMOJI_MAX_ITEMS_PER_PACK}</strong> 张
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                表情总量上限：<strong className="font-semibold text-foreground">{SMOJI_MAX_ITEMS}</strong> 张
              </span>
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1">
                导出清单体积限制：<strong className="font-semibold text-foreground">1 MB</strong>
              </span>
            </div>

            {/* Export Filenames Table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">导出目标</th>
                    <th className="px-3 py-1.5 font-medium">默认文件名格式</th>
                  </tr>
                </thead>
                <tbody id="guide-export-tbody" className="divide-y divide-border/60 font-mono">
                  {formats.map((fmt) => (
                    <tr key={fmt.id} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-sans font-medium text-foreground">{fmt.label}</td>
                      <td className="px-3 py-1.5 text-primary">
                        <code>{stampDownloadFilename(fmt.guideFilename ?? `${fmt.id}.json`)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
