import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { buildCustomExportManifest, compactExportManifest } from '../export'
import { SMOJI_MANIFEST_MAX_BYTES } from '../domain/limits'
import { workbenchReducer } from '../domain/reducer'
import {
  selectActiveCustomGroup,
  selectActiveGroupPickedSrcs,
  selectActiveInspectorItem,
  selectActivePack,
  selectBatchSelectLabel,
  selectCurrentPackAllExcluded,
  selectCurrentPackExcludedCount,
  selectExportItemCount,
  selectExportPacks,
  selectIsActiveGroupFull,
  selectIsClearPacksDisabled,
  selectItemLookupMap,
  selectSelectedPacks,
} from '../domain/selectors'
import { useVisualViewport } from '../hooks/use-visual-viewport'
import { loadInitialState, persistWorkbenchState, saveTheme } from '../persistence/storage'
import { WorkbenchContext, type WorkbenchContextValue } from './WorkbenchContext'

interface WorkbenchProviderProps {
  initialPacks?: readonly SmojiPack[]
  manifestUrl?: string
  children: ReactNode
}

function computeExportBytes(exportPacks: readonly any[], manifestUrl: string): number {
  if (exportPacks.length === 0) return 0
  try {
    const manifest = buildCustomExportManifest(exportPacks as any, manifestUrl)
    return new TextEncoder().encode(JSON.stringify(compactExportManifest(manifest, manifestUrl)) + '\n').length
  } catch {
    return 0
  }
}

export function WorkbenchProvider({
  initialPacks = [],
  manifestUrl = new URL('smoji.json', typeof window !== 'undefined' ? window.location.href : 'http://localhost/').href,
  children,
}: WorkbenchProviderProps) {
  const [state, dispatch] = useReducer(workbenchReducer, initialPacks, loadInitialState)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  useVisualViewport()

  // Centralized persistence
  useEffect(() => {
    persistWorkbenchState(state)
  }, [state])

  // Sync theme with DOM
  useEffect(() => {
    const theme = state.preferences.theme
    const root = document.documentElement
    saveTheme(theme)

    const isDark =
      theme === 'dark' ||
      (theme === 'system' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
      root.style.colorScheme = 'light'
    }
  }, [state.preferences.theme])

  // Global keyboard shortcuts (Undo/Redo, Code Dialog)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // Allow normal undo in inputs
        if (isInput) return
        e.preventDefault()
        if (e.shiftKey) {
          dispatch({ type: 'REDO' })
        } else {
          dispatch({ type: 'UNDO' })
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (isInput) return
        e.preventDefault()
        dispatch({ type: 'REDO' })
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toUpperCase() === 'P') {
        e.preventDefault()
        dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: !state.export.codeDialogOpen })
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.export.codeDialogOpen])

  // Memoized derived calculations
  const itemLookup = useMemo(() => selectItemLookupMap(state.catalog.packs), [state.catalog.packs])
  const activePack = useMemo(() => selectActivePack(state), [state])
  const activeCustomGroup = useMemo(() => selectActiveCustomGroup(state), [state])
  const selectedPacks = useMemo(() => selectSelectedPacks(state), [state])
  const exportPacks = useMemo(() => selectExportPacks(state), [state])
  const exportItemCount = useMemo(() => selectExportItemCount(state), [state])
  const batchSelectLabel = useMemo(() => selectBatchSelectLabel(state), [state])
  const isClearPacksDisabled = useMemo(() => selectIsClearPacksDisabled(state), [state])
  const activeGroupPickedSrcs = useMemo(() => selectActiveGroupPickedSrcs(state), [state])
  const currentPackExcludedCount = useMemo(() => selectCurrentPackExcludedCount(state), [state])
  const currentPackAllExcluded = useMemo(() => selectCurrentPackAllExcluded(state), [state])
  const isActiveGroupFull = useMemo(() => selectIsActiveGroupFull(state), [state])
  const activeInspectorItem = useMemo(() => selectActiveInspectorItem(state, itemLookup), [state, itemLookup])
  const exportBytes = useMemo(() => computeExportBytes(exportPacks, manifestUrl), [exportPacks, manifestUrl])
  const isOverBudget = exportBytes > SMOJI_MANIFEST_MAX_BYTES

  const contextValue: WorkbenchContextValue = {
    state,
    dispatch,
    activePack,
    activeCustomGroup,
    selectedPacks,
    exportPacks,
    exportItemCount,
    batchSelectLabel,
    isClearPacksDisabled,
    activeGroupPickedSrcs,
    currentPackExcludedCount,
    currentPackAllExcluded,
    isActiveGroupFull,
    itemLookup,
    activeInspectorItem,
    exportBytes,
    isOverBudget,
    manifestUrl,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    canUndo: state.history.undoStack.length > 0,
    canRedo: state.history.redoStack.length > 0,
  }

  return <WorkbenchContext.Provider value={contextValue}>{children}</WorkbenchContext.Provider>
}
