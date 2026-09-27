import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type PointerEvent } from 'react'
import { Dialog } from 'radix-ui'
import { Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react'
import type { SmojiItem } from 'smoji'
import { useWorkbench } from '@wb/app/WorkbenchContext'
import { useFocusReturn } from '@wb/focus-return'
import { isEditing, ownsArrowKeys } from '@wb/keyboard'
import type { CopyFormat, PreviewBackground } from '@wb/domain/state'
import { Kbd, Segmented } from '../ui/primitives'
import { Sticker } from '../ui/Sticker'
import { COPY_FORMATS, copyValue, writeClipboard } from '../lib/actions'
import { flyTo } from '../lib/fly'

export function Inspector({ navRef }: { navRef: MutableRefObject<readonly SmojiItem[]> }) {
  const { state, dispatch, activeInspectorItem, activeCustomGroup, activeGroupPickedSrcs, manifestUrl } = useWorkbench()
  const actionRef = useRef<HTMLButtonElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const focusReturn = useFocusReturn()
  const [copied, setCopied] = useState<CopyFormat | null>(null)
  const [manual, setManual] = useState<CopyFormat | null>(null)
  const item = activeInspectorItem?.item
  const src = item?.src

  useEffect(() => { setCopied(null); setManual(null) }, [src])

  const list = navRef.current
  const index = src ? list.findIndex((entry) => entry.src === src) : -1
  const go = useCallback((direction: -1 | 1) => {
    const items = navRef.current
    if (!items.length) return
    const current = items.findIndex((entry) => entry.src === src)
    const next = current === -1 ? items[0] : items[(current + direction + items.length) % items.length]
    if (next) dispatch({ type: 'OPEN_INSPECTOR', payload: next.src })
  }, [navRef, src, dispatch])

  const copy = useCallback(async (format: CopyFormat) => {
    if (!item) return
    dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: format })
    if (await writeClipboard(copyValue(item, format, manifestUrl))) {
      setManual(null)
      setCopied(format)
      window.setTimeout(() => setCopied((value) => (value === format ? null : value)), 1600)
    } else {
      setCopied(null)
      setManual(format)
    }
  }, [item, manifestUrl, dispatch])

  if (!item || !activeInspectorItem) return null

  const isCustom = state.mode === 'custom'
  const picked = activeGroupPickedSrcs.has(item.src)
  const sourcePack = state.catalog.packs.find((pack) => pack.items.some((entry) => entry.src === item.src))
  const packSelected = Boolean(sourcePack && state.packSelection.selectedPackIds.has(sourcePack.id))
  const excluded = state.packSelection.excludedItemSrcs.has(item.src)
  const groups = state.customGroups.groups
  const background = state.inspector.previewBackground
  const label = item.label || item.id

  const actionLabel = isCustom
    ? picked ? `从「${activeCustomGroup?.label ?? '分组'}」移出` : `加入「${activeCustomGroup?.label ?? '分组'}」`
    : !packSelected ? `选择「${sourcePack?.label ?? '当前分类'}」整包导出` : excluded ? '恢复到导出' : '从导出中排除'
  const removes = isCustom ? picked : packSelected && !excluded

  function act() {
    if (!item) return
    const sticker = stageRef.current?.querySelector('.insp__sticker')
    if (isCustom) {
      if (!picked) flyTo(sticker, `[data-fly-target="group-${Math.max(0, state.customGroups.activeGroupIndex)}"], [data-fly-target="groups"], [data-fly-target="bar"]`)
      dispatch({ type: 'TOGGLE_CUSTOM_ITEM', payload: item })
    } else if (sourcePack && !packSelected) {
      flyTo(sticker, '[data-fly-target="packs"], [data-fly-target="bar"]')
      dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: sourcePack.id })
    } else {
      dispatch({ type: 'TOGGLE_PACK_ITEM_EXCLUSION', payload: item.src })
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    if (isEditing(event.target, true)) return
    const format = COPY_FORMATS.find((entry) => entry.key === event.key)
    if (format && !ownsArrowKeys(event.target)) {
      event.preventDefault()
      dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: format.id })
      return
    }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !isEditing(event.target) && !ownsArrowKeys(event.target)) {
      event.preventDefault()
      go(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') swipe.current = { x: event.clientX, y: event.clientY }
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = event.clientX - start.x
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5) go(dx > 0 ? -1 : 1)
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) dispatch({ type: 'CLOSE_INSPECTOR' }) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ov ov--insp" />
        <Dialog.Content className="insp" aria-describedby={undefined} onKeyDown={onKeyDown} {...focusReturn}
          onOpenAutoFocus={(event) => {
            focusReturn.onOpenAutoFocus(event)
            event.preventDefault()
            actionRef.current?.focus()
          }}>
          <div ref={stageRef} className="insp__stage" data-preview-stage data-bg={background} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            {index >= 0 && <span className="insp__index">{index + 1}<span>/{list.length}</span></span>}
            <button id="pop-prev-btn" type="button" className="insp__nav insp__nav--prev" aria-label="上一个表情" title="上一个 (←)" onClick={() => go(-1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <Sticker key={item.src} src={item.src} alt={label} mode="live" retryable eager className="insp__sticker" />
            <button id="pop-next-btn" type="button" className="insp__nav insp__nav--next" aria-label="下一个表情" title="下一个 (→)" onClick={() => go(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
            <Segmented size="sm" label="预览背景" className="insp__bg" value={background}
              onChange={(value: PreviewBackground) => dispatch({ type: 'SET_INSPECTOR_BG', payload: value })}
              options={[{ value: 'transparent', label: '透明' }, { value: 'light', label: '浅底' }, { value: 'dark', label: '深底' }]} />
          </div>

          <div className="insp__side">
            <div className="insp__head">
              <div className="insp__titles">
                <Dialog.Title className="insp__title">{label}</Dialog.Title>
                <p className="insp__meta">
                  <span className="tag">{activeInspectorItem.packLabel}</span>
                  <span className="tag tag--mono">{activeInspectorItem.format}</span>
                </p>
              </div>
              <Dialog.Close id="pop-close-btn" className="icon-btn" aria-label="关闭详情"><X aria-hidden="true" /></Dialog.Close>
            </div>

            <div className="copy" role="group" aria-label="复制">
              {COPY_FORMATS.map((format) => {
                const value = copyValue(item, format.id, manifestUrl)
                const active = state.inspector.copyFormat === format.id
                return (
                  <div key={format.id} className="copy__row" data-active={active || undefined} data-copied={copied === format.id || undefined}>
                    <span className="copy__fmt">{format.label}<Kbd>{format.key}</Kbd></span>
                    {manual === format.id ? (
                      <input id="copy-active-input" className="copy__manual" readOnly value={value} aria-label={`${format.label} 复制内容`}
                        ref={(node) => { if (node && document.activeElement !== node) { node.focus(); node.select() } }}
                        onClick={(event) => event.currentTarget.select()} />
                    ) : (
                      <code className="copy__code" title={value}>{value}</code>
                    )}
                    <button type="button" id={active ? 'btn-copy-active' : undefined} data-copy-format={format.id} className="copy__btn"
                      aria-label={`复制 ${format.label}`} onClick={() => copy(format.id)}>
                      {copied === format.id ? <Check aria-hidden="true" strokeWidth={2.6} /> : <Copy aria-hidden="true" />}
                      <span>{copied === format.id ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                )
              })}
              <div id="copy-feedback" role="status" aria-live="polite" aria-atomic="true" className={manual ? 'copy__feedback' : 'sr-only'}>
                {manual ? '请按 ⌘/Ctrl+C 手动复制' : copied ? '已复制' : ''}
              </div>
            </div>

            <div className="insp__foot">
              {isCustom && groups.length > 0 && (
                <label className="insp__target">
                  <span>目标自选分组</span>
                  <select id="pop-target-group" className="field field--select" value={state.customGroups.activeGroupIndex}
                    onChange={(event) => dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: Number(event.target.value) })}>
                    {groups.map((group, groupIndex) => (
                      <option key={group.id} value={groupIndex}>{group.label}（{group.items.length} 张）</option>
                    ))}
                  </select>
                </label>
              )}
              <button ref={actionRef} id="pop-group-btn" type="button" aria-keyshortcuts="Space" aria-describedby="pop-keyboard-hint"
                className={`btn btn--lg ${removes ? 'btn--danger-soft' : 'btn--ink'}`} onClick={act}>
                {actionLabel}
              </button>
              <p id="pop-keyboard-hint" className="insp__hint">
                <Kbd>空格</Kbd>执行当前选择操作<i>·</i><Kbd>←</Kbd><Kbd>→</Kbd>翻图<i>·</i><Kbd>1</Kbd>–<Kbd>5</Kbd>选格式<i>·</i><Kbd>Esc</Kbd>关闭
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
