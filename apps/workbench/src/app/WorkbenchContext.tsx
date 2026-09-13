import { createContext, useContext } from 'react'
import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import type { WorkbenchAction } from '../domain/actions'
import type { EditableCustomPack, WorkbenchState } from '../domain/state'

export interface WorkbenchContextValue {
  state: WorkbenchState
  dispatch: React.Dispatch<WorkbenchAction>

  activePack: SmojiPack | undefined
  activeCustomGroup: EditableCustomPack | undefined
  selectedPacks: readonly SmojiPack[]
  exportPacks: readonly (SmojiPack | EditableCustomPack)[]
  exportItemCount: number
  batchSelectLabel: '全选' | '反选'
  isClearPacksDisabled: boolean
  activeGroupPickedSrcs: ReadonlySet<string>
  currentPackExcludedCount: number
  currentPackAllExcluded: boolean
  isActiveGroupFull: boolean
  itemLookup: Map<string, SmojiItem>
  activeInspectorItem: { item: SmojiItem; packLabel: string; format: string } | null
  exportBytes: number
  isOverBudget: boolean
  manifestUrl: string

  mobileDrawerOpen: boolean
  setMobileDrawerOpen: (open: boolean) => void

  canUndo: boolean
  canRedo: boolean
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function useWorkbench(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider')
  }
  return ctx
}
