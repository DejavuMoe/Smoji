import { memo, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import type { SmojiPack } from 'smoji'
import { useWorkbench } from '@wb/app/WorkbenchContext'
import { Sticker } from '../ui/Sticker'
import { flyTo } from '../lib/fly'

interface PackListProps {
  onNavigate?: () => void
  /** The drawer already titles the list. */
  showTitle?: boolean
}

export function PackList({ onNavigate, showTitle = true }: PackListProps) {
  const { state, dispatch, batchSelectLabel, isClearPacksDisabled } = useWorkbench()
  const navRef = useRef<HTMLDivElement | null>(null)
  const packs = state.catalog.packs
  const isPacksMode = state.mode === 'packs'

  // One tab stop for the whole list: ↑/↓ move between packs, ←/→ between a pack and its checkbox.
  const controls = () => Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>('.pack, .pack-check') ?? [])
  const rove = (target: HTMLElement | null) => {
    if (!target) return
    for (const control of controls()) control.tabIndex = control === target ? 0 : -1
  }
  useLayoutEffect(() => {
    const all = controls()
    if (!all.some((control) => control.tabIndex === 0)) rove(navRef.current?.querySelector<HTMLElement>('.pack[aria-current="true"]') ?? all[0] ?? null)
  })

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target as HTMLElement
    const row = target.closest<HTMLElement>('.pack-row')
    if (!row || !navRef.current) return
    const rows = Array.from(navRef.current.querySelectorAll<HTMLElement>('.pack-row'))
    const index = rows.indexOf(row)
    const column = target.classList.contains('pack-check') ? '.pack-check' : '.pack'
    let next: HTMLElement | null = null
    let nextIndex = index
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
        : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      next = rows[nextIndex]?.querySelector<HTMLElement>(column) ?? null
    } else if (event.key === 'ArrowRight') next = row.querySelector<HTMLElement>('.pack-check')
    else if (event.key === 'ArrowLeft') next = row.querySelector<HTMLElement>('.pack')
    else return
    event.preventDefault()
    if (!next) return
    rove(next)
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
    if (column === '.pack' && nextIndex !== index) dispatch({ type: 'SET_ACTIVE_PACK', payload: nextIndex })
  }

  return (
    <div className="packs">
      <div className="packs__head">
        {showTitle ? <h2 className="eyebrow">表情分类 <span className="eyebrow__n">{packs.length}</span></h2> : <span className="eyebrow">{packs.length} 个分类</span>}
        {isPacksMode && (
          <div className="packs__batch">
            <button id="btn-select-all-packs" type="button" className="link-btn" aria-label={`${batchSelectLabel}表情包`}
              onClick={() => dispatch({ type: 'BATCH_SELECT_PACKS' })}>{batchSelectLabel}</button>
            <button id="btn-clear-packs" type="button" className="link-btn link-btn--muted" disabled={isClearPacksDisabled}
              onClick={() => dispatch({ type: 'CLEAR_PACK_SELECTION' })}>清空</button>
          </div>
        )}
      </div>
      <div ref={navRef} id="pack-nav" className="packs__list" onKeyDown={onKeyDown}
        onFocus={(event: FocusEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).matches('.pack, .pack-check')) rove(event.target as HTMLElement) }}>
        {packs.map((pack, index) => (
          <PackRow key={pack.id} pack={pack} index={index}
            active={index === state.catalog.activePackIndex}
            checked={state.packSelection.selectedPackIds.has(pack.id)}
            selectable={isPacksMode} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}

interface PackRowProps {
  pack: SmojiPack
  index: number
  active: boolean
  checked: boolean
  selectable: boolean
  onNavigate?: () => void
}

const PackRow = memo(function PackRow({ pack, index, active, checked, selectable, onNavigate }: PackRowProps) {
  const { dispatch, state } = useWorkbench()
  const cover = pack.items[0]
  return (
    <div className="pack-row" data-active={active || undefined} data-included={(selectable && checked) || undefined}>
      <button type="button" className="pack" data-pack-index={index} aria-current={active ? 'true' : undefined} tabIndex={-1}
        onClick={() => {
          dispatch({ type: 'SET_ACTIVE_PACK', payload: index })
          if (state.mode === 'custom') dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })
          onNavigate?.()
        }}>
        <span className="pack__cover">{cover && <Sticker src={cover.src} alt="" />}</span>
        <span className="pack__name">{pack.label}</span>
        <span className="pack__n">{pack.items.length}</span>
      </button>
      {selectable && (
        <button type="button" role="checkbox" className="pack-check" data-pack-id={pack.id} aria-checked={checked} tabIndex={-1}
          aria-label={`选择 ${pack.label}`}
          onClick={(event) => {
            if (!checked) flyTo(event.currentTarget.closest('.pack-row')?.querySelector('.pack__cover'), '[data-fly-target="packs"]')
            dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: pack.id })
          }}>
          <Check aria-hidden="true" />
        </button>
      )}
    </div>
  )
})
