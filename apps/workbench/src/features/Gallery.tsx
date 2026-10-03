import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Check, Copy, Minus, Plus, RotateCcw, Smile, X } from 'lucide-react'
import type { SmojiItem, SmojiPack } from 'smoji'
import { useWorkbench } from '../app/WorkbenchContext'
import { useRovingGrid } from '../hooks/use-roving-grid'
import { useReducedMotion } from '../hooks/use-reduced-motion'
import { SMOJI_MAX_ITEMS_PER_PACK } from '../domain/limits'
import { showToast } from './feedback/toast'
import { Segmented } from '../ui/primitives'
import { Sticker } from '../ui/Sticker'
import { COPY_FORMATS, copyValue, writeClipboard } from '../lib/actions'
import { flyTo } from '../lib/fly'

interface GalleryProps {
  navRef: MutableRefObject<readonly SmojiItem[]>
}

export function Gallery({ navRef }: GalleryProps) {
  const { state, dispatch, activePack, activeCustomGroup, activeGroupPickedSrcs, manifestUrl } = useWorkbench()
  const isCustom = state.mode === 'custom'
  const isPicked = isCustom && state.gallery.view === 'picked'
  const comfortable = state.gallery.density === 'comfortable'
  const reducedMotion = useReducedMotion()

  const packOf = useMemo(() => {
    const map = new Map<string, SmojiPack>()
    for (const pack of state.catalog.packs) for (const item of pack.items) if (!map.has(item.src)) map.set(item.src, pack)
    return map
  }, [state.catalog.packs])

  // One list drives rendering, roving focus and inspector paging.
  const items = isPicked ? activeCustomGroup?.items ?? [] : activePack?.items ?? []
  navRef.current = items
  const limit = state.gallery.renderLimit
  const visible = useMemo(() => items.slice(0, limit), [items, limit])
  const remaining = Math.max(0, items.length - limit)

  const gridRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { handleKeyDown, handleFocus } = useRovingGrid(gridRef)

  useEffect(() => {
    const scroller = gridRef.current?.closest('.stage__scroll')
    if (scroller) scroller.scrollTop = 0
  }, [state.catalog.activePackIndex, state.customGroups.activeGroupIndex, state.mode, state.gallery.view])

  const expand = useCallback(() => dispatch({ type: 'EXPAND_RENDER_LIMIT' }), [dispatch])

  useEffect(() => {
    if (remaining <= 0 || typeof IntersectionObserver === 'undefined') return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) expand() }, { rootMargin: '400px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [remaining, expand, visible.length])

  const onOpen = useCallback((item: SmojiItem) => dispatch({ type: 'OPEN_INSPECTOR', payload: item.src }), [dispatch])

  const onAction = useCallback((item: SmojiItem, source: Element | null, picked: boolean) => {
    if (state.mode === 'custom') {
      if (!picked) {
        const index = Math.max(0, state.customGroups.activeGroupIndex)
        flyTo(source, `[data-fly-target="group-${index}"], [data-fly-target="groups"], [data-fly-target="bar"]`)
      }
      dispatch({ type: 'TOGGLE_CUSTOM_ITEM', payload: item })
    } else {
      dispatch({ type: 'TOGGLE_PACK_ITEM_EXCLUSION', payload: item.src })
    }
  }, [state.mode, state.customGroups.activeGroupIndex, dispatch])

  const format = state.inspector.copyFormat
  const onCopy = useCallback(async (item: SmojiItem) => {
    const label = COPY_FORMATS.find((entry) => entry.id === format)?.label ?? ''
    if (await writeClipboard(copyValue(item, format, manifestUrl))) showToast(`已复制 ${label}`, 'success')
    else {
      showToast('复制失败，请在详情中手动复制', 'error')
      dispatch({ type: 'OPEN_INSPECTOR', payload: item.src })
    }
  }, [format, manifestUrl, dispatch])

  const selectedPackIds = state.packSelection.selectedPackIds
  const excluded = state.packSelection.excludedItemSrcs

  return (
    <div className="stage__scroll">
      <GalleryHeader isPicked={isPicked} />
      {items.length === 0
        ? <GalleryEmpty isPicked={isPicked} />
        : (
          <div className="gallery">
            <div ref={gridRef} id="grid" role="group" aria-label="表情图库" tabIndex={-1}
              className="grid" data-density={state.gallery.density} data-view={isPicked ? 'picked' : undefined}
              onKeyDown={handleKeyDown} onFocus={handleFocus}>
              {visible.map((item, index) => {
                const pack = isPicked ? packOf.get(item.src) : activePack
                return (
                  <Tile key={item.src} item={item} index={index} custom={isCustom}
                    picked={isCustom && activeGroupPickedSrcs.has(item.src)}
                    excluded={!isCustom && excluded.has(item.src)}
                    actionable={isCustom || Boolean(pack && selectedPackIds.has(pack.id))}
                    comfortable={comfortable} playable={!reducedMotion}
                    onOpen={onOpen} onAction={onAction} onCopy={onCopy} />
                )
              })}
            </div>
            {remaining > 0 && (
              <div ref={sentinelRef} className="gallery__more">
                <button type="button" className="btn btn--ghost" onClick={expand}>加载更多 ({remaining} 张剩余)</button>
              </div>
            )}
          </div>
        )}
    </div>
  )
}

interface TileProps {
  item: SmojiItem
  index: number
  custom: boolean
  picked: boolean
  excluded: boolean
  actionable: boolean
  comfortable: boolean
  /** Animated originals play only while this tile is hovered or keyboard-focused. */
  playable: boolean
  onOpen: (item: SmojiItem) => void
  onAction: (item: SmojiItem, source: Element | null, picked: boolean) => void
  onCopy: (item: SmojiItem) => void
}

const Tile = memo(function Tile({ item, index, custom, picked, excluded, actionable, comfortable, playable, onOpen, onAction, onCopy }: TileProps) {
  const [active, setActive] = useState(false)
  const label = item.label || item.id
  const actionLabel = custom ? (picked ? `移出 ${label}` : `加入 ${label}`) : (excluded ? `恢复 ${label}` : `排除 ${label}`)
  const ActionIcon = custom ? (picked ? Minus : Plus) : (excluded ? RotateCcw : X)
  return (
    <div className="tile" data-card-index={index} data-picked={picked || undefined} data-excluded={excluded || undefined}
      draggable
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setActive(true) }}
      onPointerLeave={() => setActive(false)}
      onFocus={(event) => { if (event.target.matches(':focus-visible')) setActive(true) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setActive(false) }}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/smoji-src', item.src)
        event.dataTransfer.effectAllowed = 'copyMove'
        const media = event.currentTarget.querySelector<HTMLElement>('.sticker__media')
        if (media) event.dataTransfer.setDragImage(media, media.clientWidth / 2, media.clientHeight / 2)
      }}>
      <button type="button" className="tile__open" data-roving-item="true" tabIndex={index === 0 ? 0 : -1}
        aria-label={`${label}，打开预览并复制`} onClick={() => onOpen(item)}>
        <Sticker src={item.src} alt={label} className="tile__sticker" play={playable && active && !excluded} />
        {comfortable && <span className="tile__label"><span className="tile__name">{label}</span></span>}
      </button>
      {picked && <span className="tile__badge" aria-hidden="true"><Check /></span>}
      <div className="tile__tools">
        <button type="button" className="tile__tool" tabIndex={-1} aria-label={`复制 ${label}`}
          onClick={(event) => { event.stopPropagation(); onCopy(item) }}>
          <Copy aria-hidden="true" />
        </button>
        {actionable && (
          <button type="button" className="tile__tool tile__tool--act" tabIndex={-1} aria-label={actionLabel}
            onClick={(event) => { event.stopPropagation(); onAction(item, event.currentTarget.closest('.tile'), picked) }}>
            <ActionIcon aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
})

function GalleryHeader({ isPicked }: { isPicked: boolean }) {
  const { state, dispatch, activePack, activeCustomGroup, currentPackExcludedCount, currentPackAllExcluded } = useWorkbench()
  const isCustom = state.mode === 'custom'
  const selected = Boolean(activePack && state.packSelection.selectedPackIds.has(activePack.id))
  const groupCount = activeCustomGroup?.items.length ?? 0
  const cover = !isPicked ? activePack?.items[0] : undefined

  return (
    <header className="ghead">
      <div className="ghead__title-row">
        {cover && <Sticker key={cover.src} src={cover.src} alt="" className="ghead__cover" eager />}
        <div className="ghead__titles">
          {isPicked && <p className="eyebrow">自选分组</p>}
          <h1 className="ghead__title">{isPicked ? activeCustomGroup?.label ?? '已入组表情' : activePack?.label ?? '表情'}</h1>
          <p id="gallery-export-count" className="ghead__meta">
            {isPicked
              ? `${groupCount} / ${SMOJI_MAX_ITEMS_PER_PACK} 张`
              : isCustom
                ? activeCustomGroup
                  ? <>添加到「<strong>{activeCustomGroup.label}</strong>」 · 当前分组 {groupCount} 张</>
                  : '自选分组未激活'
                : <>{activePack?.items.length ?? 0} 张{currentPackExcludedCount > 0 && <> · <span className="ghead__warn">已排除 {currentPackExcludedCount} 张</span></>}</>}
          </p>
        </div>
        <div className="ghead__side">
          <Segmented id="density-toggle" size="sm" label="显示密度" value={state.gallery.density}
            onChange={(value) => dispatch({ type: 'SET_GALLERY_DENSITY', payload: value })}
            options={[{ value: 'compact', label: '紧凑' }, { value: 'comfortable', label: '舒适' }]} />
        </div>
      </div>
      <div className="ghead__actions">
        {isCustom && (
          <Segmented id="gallery-view-picked" size="sm" label="图库范围" value={isPicked ? 'picked' : 'source'}
            onChange={(value) => dispatch({ type: 'SET_GALLERY_VIEW', payload: value })}
            options={[{ value: 'source', label: '当前分类' }, { value: 'picked', label: `已入组 (${groupCount})` }]} />
        )}
        {!isCustom && activePack && (
          <button type="button" className={`btn ${selected ? 'btn--mark' : 'btn--ink'}`} aria-pressed={selected}
            onClick={() => {
              if (!selected) flyTo(document.querySelector('.grid .tile__sticker'), '[data-fly-target="packs"], [data-fly-target="bar"]')
              dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: activePack.id })
            }}>
            {selected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {selected ? '已选择本分类导出' : '选择本分类导出'}
          </button>
        )}
        {!isCustom && activePack && selected && (
          <button id="btn-batch-pack-action" type="button" className="btn btn--ghost"
            onClick={() => dispatch({ type: currentPackAllExcluded ? 'RESTORE_CURRENT_PACK_ALL' : 'EXCLUDE_CURRENT_PACK_ALL' })}>
            {currentPackAllExcluded ? '恢复本分类全部' : '排除本分类全部'}
          </button>
        )}
        {isCustom && !isPicked && (
          <button id="btn-batch-pack-action" type="button" className="btn btn--ghost"
            onClick={() => dispatch({ type: 'ADD_ALL_CURRENT_PACK_TO_CUSTOM' })}>
            <Plus aria-hidden="true" />本分类全部加入
          </button>
        )}
      </div>
    </header>
  )
}

function GalleryEmpty({ isPicked }: { isPicked: boolean }) {
  const { dispatch } = useWorkbench()
  if (isPicked) {
    return (
      <div id="gallery-empty-cta" className="empty">
        <Smile className="empty__icon" aria-hidden="true" />
        <h2 className="empty__title">当前分组暂无表情</h2>
        <p className="empty__text">从「当前分类」中点击加号或拖拽表情到此分组。</p>
        <button id="gallery-empty-action" type="button" className="btn btn--ink"
          onClick={() => dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })}>去浏览表情</button>
      </div>
    )
  }
  return (
    <div id="gallery-empty-cta" className="empty">
      <Smile className="empty__icon" aria-hidden="true" />
      <h2 className="empty__title">暂无表情</h2>
      <p className="empty__text">该分类下没有包含任何表情图片。</p>
    </div>
  )
}
