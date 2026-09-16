import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
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
    <ToggleGroup aria-label="预览背景" value={currentBg} onValueChange={(value) => dispatch({ type: 'SET_INSPECTOR_BG', payload: value as PreviewBackground })} className="flex">
      {options.map((opt) => <ToggleGroupItem key={opt.value} value={opt.value}>{opt.label}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
