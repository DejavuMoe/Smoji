import { useWorkbench } from '../../app/WorkbenchContext'
import type { PreviewBackground } from '../../domain/state'

export function PreviewBackgroundToggle() {
  const { state, dispatch } = useWorkbench()
  const currentBg = state.inspector.previewBackground

  const options: { value: PreviewBackground; label: string }[] = [
    { value: 'transparent', label: '透明' },
    { value: 'light', label: '浅底' },
    { value: 'dark', label: '深底' },
  ]

  return (
    <div className="flex rounded-lg bg-muted p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`flex-1 rounded-md py-1 text-center font-medium transition-colors ${
            currentBg === opt.value
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => dispatch({ type: 'SET_INSPECTOR_BG', payload: opt.value })}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
