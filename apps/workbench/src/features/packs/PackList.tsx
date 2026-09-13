import { useCallback, type KeyboardEvent } from 'react'
import { useWorkbench } from '../../app/WorkbenchContext'
import { PackRow } from './PackRow'

export function PackList() {
  const { state, dispatch, batchSelectLabel, isClearPacksDisabled } = useWorkbench()
  const packs = state.catalog.packs
  const selectedIds = state.packSelection.selectedPackIds
  const activeIndex = state.catalog.activePackIndex

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#pack-nav button.pack'))
      if (buttons.length === 0) return
      const currentIndex = buttons.findIndex((btn) => btn === document.activeElement)
      if (currentIndex === -1) return

      e.preventDefault()
      const nextIndex =
        e.key === 'ArrowDown'
          ? Math.min(buttons.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1)
      const target = buttons[nextIndex]
      target?.focus()
      dispatch({ type: 'SET_ACTIVE_PACK', payload: nextIndex })
    },
    [dispatch],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-foreground">表情分类</span>
        <div className="flex items-center gap-1.5">
          <button
            id="btn-select-all-packs"
            type="button"
            className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={`${batchSelectLabel}表情包`}
            aria-label={`${batchSelectLabel}表情包`}
            onClick={() => dispatch({ type: 'BATCH_SELECT_PACKS' })}
          >
            {batchSelectLabel}
          </button>
          <button
            id="btn-clear-packs"
            type="button"
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            disabled={isClearPacksDisabled}
            onClick={() => dispatch({ type: 'CLEAR_PACK_SELECTION' })}
          >
            清空
          </button>
        </div>
      </div>

      <div
        id="pack-nav"
        className="flex flex-col gap-0.5 overflow-y-auto px-1"
        onKeyDown={handleKeyDown}
      >
        {packs.map((pack, index) => (
          <PackRow
            key={pack.id}
            pack={pack}
            index={index}
            isActive={index === activeIndex}
            isChecked={selectedIds.has(pack.id)}
          />
        ))}
      </div>
    </div>
  )
}
