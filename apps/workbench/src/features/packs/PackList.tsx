import { Button } from '../../components/ui/button'
import { useCallback, useRef, type KeyboardEvent } from 'react'
import { useWorkbench } from '../../app/WorkbenchContext'
import { PackRow } from './PackRow'

export function PackList() {
  const { state, dispatch, batchSelectLabel, isClearPacksDisabled } = useWorkbench()
  const navRef = useRef<HTMLDivElement | null>(null)
  const packs = state.catalog.packs
  const selectedIds = state.packSelection.selectedPackIds
  const activeIndex = state.catalog.activePackIndex

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      // Stay inside this navigation container: a second workspace copy must not pollute the targets.
      const buttons = Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>('button.pack') ?? [])
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
        {state.mode === 'packs' && <div className="flex items-center gap-1.5">
          <Button variant="ghost"
            id="btn-select-all-packs"
            type="button"
            className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted "
            tooltip={`${batchSelectLabel}表情包`}
            aria-label={`${batchSelectLabel}表情包`}
            onClick={() => dispatch({ type: 'BATCH_SELECT_PACKS' })}
          >
            {batchSelectLabel}
          </Button>
          <Button variant="ghost"
            id="btn-clear-packs"
            type="button"
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            disabled={isClearPacksDisabled}
            onClick={() => dispatch({ type: 'CLEAR_PACK_SELECTION' })}
          >
            清空
          </Button>
        </div>}
      </div>

      <div
        ref={navRef}
        id="pack-nav"
        className="flex flex-col gap-0.5 min-w-0 px-1"
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
