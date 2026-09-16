import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import type { SmojiPack } from '../../../../../packages/smoji/src/types'
import { useWorkbench } from '../../app/WorkbenchContext'

interface PackRowProps {
  pack: SmojiPack
  index: number
  isActive: boolean
  isChecked: boolean
}

export function PackRow({ pack, index, isActive, isChecked }: PackRowProps) {
  const { dispatch, state, setMobileDrawerOpen } = useWorkbench()
  const isCustomMode = state.mode === 'custom'

  function handleSelect() {
    dispatch({ type: 'SET_ACTIVE_PACK', payload: index })
    if (isCustomMode) dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })
    setMobileDrawerOpen(false)
  }

  return (
    <div
      className={`pack-row group flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
        isActive ? 'is-on bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
      data-pack-index={String(index)}
    >
      {!isCustomMode && <label className="flex shrink-0 cursor-pointer items-center p-0.5">
        <Checkbox
          className="pack-check"
          data-pack-id={pack.id}
          checked={isChecked}
          aria-label={`选择 ${pack.label}`}
          onCheckedChange={(checked) => {
            if (typeof checked === 'boolean' && checked !== isChecked) dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: pack.id })
          }}
        />
      </label>}
      <Button variant="ghost"
        type="button"
        className="pack flex min-w-0 flex-1 items-center justify-between py-1 text-left text-xs "
        data-pack-index={String(index)}
        aria-current={isActive ? 'true' : undefined}
        onClick={handleSelect}
      >
        <span className="truncate">{pack.label}</span>
        <span className="ml-1 shrink-0 text-[11px] tabular-nums text-muted-foreground/80 group-hover:text-muted-foreground">
          {pack.items.length}
        </span>
      </Button>
    </div>
  )
}
