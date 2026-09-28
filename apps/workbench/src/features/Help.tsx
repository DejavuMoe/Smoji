import { Fragment } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useWorkbench } from '../app/WorkbenchContext'
import { useFocusReturn } from '../focus-return'
import { dockExportFormats, stampDownloadFilename } from '../export'
import { SMOJI_MAX_ITEMS, SMOJI_MAX_ITEMS_PER_PACK, SMOJI_MAX_PACKS } from '../domain/limits'
import { Kbd } from '../ui/primitives'

const SHORTCUTS: [string[][], string][] = [
  [[['↑', '↓', '←', '→'], ['Home', 'End']], '在图库中移动；分类列表用上下键浏览，左右键切换到勾选框'],
  [[['Enter']], '打开表情详情'],
  [[['←', '→']], '详情中翻到上一个 / 下一个'],
  [[['1'], ['4']], '详情中依次切换 Markdown、URL、HTML、BBCode'],
  [[['空格']], '详情中执行当前选择操作：选择 / 排除，或加入 / 移出'],
  [[['Alt', '←'], ['Alt', '→']], '分组托盘内左右排序'],
  [[['Delete']], '把托盘中的表情移出分组'],
  [[['⌘/Ctrl', 'Z'], ['⌘/Ctrl', 'Shift', 'Z']], '撤销 / 重做自选分组操作'],
  [[['⌘/Ctrl', 'Shift', 'P']], '打开或关闭导出预览'],
  [[['⌘/Ctrl', 'E']], '下载当前导出配置'],
  [[['?']], '打开使用指南'],
  [[['Esc']], '关闭当前弹层并归还焦点'],
]

export function Help() {
  const { state, dispatch } = useWorkbench()
  const focusReturn = useFocusReturn('#btn-open-guide, #grid')
  const formats = dockExportFormats()
  return (
    <Dialog.Root open={state.export.helpDialogOpen} onOpenChange={(open) => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: open })}>
      <Dialog.Portal>
        <Dialog.Overlay className="ov" />
        <Dialog.Content id="guide-modal" className="dlg help" aria-describedby={undefined} {...focusReturn}>
          <header className="help__head">
            <Dialog.Title className="dlg__title">使用指南</Dialog.Title>
            <Dialog.Close id="guide-modal-close" className="icon-btn" aria-label="关闭使用指南"><X aria-hidden="true" /></Dialog.Close>
          </header>
          <div className="help__body">
            <section className="help__modes" aria-label="工作模式">
              <div>
                <h3>按分类导出</h3>
                <p>勾选完整分类，导出分类内全部表情；可逐张排除。</p>
              </div>
              <div>
                <h3>自选分组</h3>
                <p>创建自己的分组，跨分类添加、排序、拆分与合并，并可导入或备份。</p>
              </div>
            </section>

            <section>
              <h3 className="eyebrow">快捷键</h3>
              <dl className="keys">
                {SHORTCUTS.map(([combos, description]) => (
                  <div key={description} className="keys__row">
                    <dt>
                      {combos.map((combo, comboIndex) => (
                        <Fragment key={comboIndex}>
                          {comboIndex > 0 && <span className="keys__or">{combos.length === 2 && /^\d$/.test(combo[0] ?? '') ? '–' : '/'}</span>}
                          <span className="keys__combo">{combo.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
                        </Fragment>
                      ))}
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="eyebrow">容量限制</h3>
              <div className="limits">
                <div><strong data-guide-limit="packs-n">{SMOJI_MAX_PACKS}</strong><span>单次最多分类</span></div>
                <div><strong>{SMOJI_MAX_ITEMS_PER_PACK}</strong><span>每组上限（张）</span></div>
                <div><strong>{SMOJI_MAX_ITEMS.toLocaleString('zh-CN')}</strong><span>表情总量上限（张）</span></div>
                <div><strong>1 MB</strong><span>导出清单体积限制</span></div>
              </div>
            </section>

            <section>
              <h3 className="eyebrow">导出文件</h3>
              <table className="files">
                <thead><tr><th>导出目标</th><th>适用</th><th>默认文件名格式</th></tr></thead>
                <tbody id="guide-export-tbody">
                  {formats.map((format) => (
                    <tr key={format.id}>
                      <td>{format.label}</td>
                      <td>{format.guideTarget}</td>
                      <td><code>{stampDownloadFilename(format.guideFilename ?? `${format.id}.json`)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
