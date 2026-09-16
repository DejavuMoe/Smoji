import { Button } from '../../components/ui/button'
import { X, ExternalLink, Keyboard, Layers, FileJson } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useFocusReturn } from '../../focus-return'
import { dockExportFormats, stampDownloadFilename } from '../../export'
import { SMOJI_MAX_PACKS, SMOJI_MAX_ITEMS_PER_PACK, SMOJI_MAX_ITEMS } from '../../domain/limits'

export function HelpDialog() {
  const { state, dispatch } = useWorkbench()
  const isOpen = state.export.helpDialogOpen

  const focusReturn = useFocusReturn('#btn-open-guide')

  const formats = dockExportFormats()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: open })}>
      <DialogContent {...focusReturn} id="guide-modal" showCloseButton={false} className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6 sm:rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
          <DialogTitle className="text-sm sm:text-base font-semibold text-foreground truncate min-w-0 flex-1">
            Smoji 使用指南与接入规范
          </DialogTitle>
          <Button variant="ghost"
            id="guide-modal-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="关闭使用指南"
            onClick={() => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: false })}
          >
            <X className="h-4 w-4" />
          </Button>
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
            <dl className="grid gap-2">
              {[
                ['Tab / Shift+Tab', '前后移动焦点；弹窗内循环。'],
                ['方向键 · Home / End', '图库按位置移动；Home/End 到已渲染首/末项，剩余内容用“加载更多”。分类名称用上下键浏览。'],
                ['Enter / Space', '激活按钮；卡片打开详情后焦点在选择按钮，Space 选择/排除或加入/移出，Esc 关闭。Tab 到其他控件后，Space 执行该控件操作。'],
                ['← / → · 数字 1–5', '详情普通区域左右翻图；数字依次切 Markdown、URL、Hugo、HTML、BBCode。格式、下拉和菜单的方向键仅操作自身。'],
                ['Alt+← / → · Delete', '托盘图片左右排序；Delete 或 Backspace 移出，焦点留在相邻项。'],
                ['⌘/Ctrl+Z · ⌘/Ctrl+Shift+Z', '撤销/重做自选分组操作（也支持 ⌘/Ctrl+Y）；编辑框使用文本自身撤销。'],
                ['⌘/Ctrl+Shift+P', '页面打开导出预览，预览内再次按下关闭；编辑框或其他弹层内不触发。'],
                ['⌘/Ctrl+E', '页面有可导出内容时下载；编辑框、菜单或弹窗内不触发。'],
                ['Escape', '关闭当前弹层/菜单并归还焦点；编辑分组时取消编辑。'],
              ].map(([key, description]) => (
                <div key={key} className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <dt className="font-mono font-medium">{key}</dt>
                  <dd className="text-muted-foreground">{description}</dd>
                </div>
              ))}
            </dl>
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
