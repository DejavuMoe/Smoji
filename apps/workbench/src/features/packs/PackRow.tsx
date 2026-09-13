import type { SmojiPack } from '../../../../../packages/smoji/src/types'
import { useWorkbench } from '../../app/WorkbenchContext'

interface PackRowProps {
  pack: SmojiPack
  index: number
  isActive: boolean
  isChecked: boolean
}

export function PackRow({ pack, index, isActive, isChecked }: PackRowProps) {
  const { dispatch, state } = useWorkbench()
  const isCustomMode = state.mode === 'custom'

  function handleCheck(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: pack.id })
  }

  function handleSelect() {
    dispatch({ type: 'SET_ACTIVE_PACK', payload: index })
  }

  return (
    <div
      className={`pack-row group flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
        isActive ? 'is-on bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
      data-pack-index={String(index)}
    >
      <label className="flex shrink-0 cursor-pointer items-center p-0.5">
        <input
          type="checkbox"
          className="pack-check h-4 w-4 rounded border-border text-primary accent-primary focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          data-pack-id={pack.id}
          checked={isChecked}
          disabled={isCustomMode}
          tabIndex={-1}
          aria-checked={isChecked}
          aria-label={`选择 ${pack.label}`}
          aria-hidden={isCustomMode ? 'true' : undefined}
          onChange={handleCheck}
        />
      </label>
      <button
        type="button"
        className="pack flex min-w-0 flex-1 items-center justify-between py-1 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
        data-pack-index={String(index)}
        aria-current={isActive ? 'true' : undefined}
        onClick={handleSelect}
      >
        <span className="truncate">{pack.label}</span>
        <span className="ml-1 shrink-0 text-[11px] tabular-nums text-muted-foreground/80 group-hover:text-muted-foreground">
          {pack.items.length}
        </span>
      </button>
    </div>
  )
}
