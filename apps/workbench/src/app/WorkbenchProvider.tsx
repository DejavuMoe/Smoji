import { TooltipProvider } from '../components/ui/tooltip'
import { isEditing, hasOpenOverlay } from '../keyboard'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { exportErrorMessage, generateFormattedExport } from '../export'
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
  selectExportPacks,
  selectIsActiveGroupFull,
  selectIsClearPacksDisabled,
  selectItemLookupMap,
  selectSelectedPacks,
} from '../domain/selectors'
import { useVisualViewport } from '../hooks/use-visual-viewport'
import { loadInitialState, persistWorkbenchState, saveTheme } from '../persistence/storage'
import { showToast } from '../features/feedback/toast'
import { WorkbenchContext, type WorkbenchContextValue } from './WorkbenchContext'

interface WorkbenchProviderProps {
  initialPacks?: readonly SmojiPack[]
  manifestUrl?: string
  children: ReactNode
}

export function WorkbenchProvider({
  initialPacks = [],
  manifestUrl = new URL('smoji.json', typeof window !== 'undefined' ? window.location.href : 'http://localhost/').href,
  children,
}: WorkbenchProviderProps) {
  const [state, dispatch] = useReducer(workbenchReducer, initialPacks, (packs) => loadInitialState(packs, manifestUrl))
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const lastNoticeToken = useRef(0)

  useVisualViewport()

  // Centralized persistence: surface write failures instead of pretending the data is saved.
  useEffect(() => {
    const result = persistWorkbenchState(state)
    setStorageWarning((previous) => {
      if (result.ok) return previous === null ? previous : null
      const next = `浏览器存储不可用或已满，以下内容未能保存：${result.failures.join('、')}。请下载分组备份以免丢失。`
      return previous === next ? previous : next
    })
  }, [state.mode, state.packSelection, state.customGroups, state.gallery.density, state.inspector.copyFormat, state.export.format, state.preferences.theme])

  // Single shared transaction result channel: reducer rejections/notices reach the user once.
  useEffect(() => {
    const notice = state.customGroups.notice
    if (!notice || notice.token === 0 || notice.token === lastNoticeToken.current) return
    lastNoticeToken.current = notice.token
    showToast(notice.message, notice.tone === 'error' ? 'error' : 'success')
    dispatch({ type: 'CLEAR_CUSTOM_GROUP_NOTICE' })
  }, [state.customGroups.notice])

  // Sync theme with DOM
  useEffect(() => {
    const theme = state.preferences.theme
    const root = document.documentElement
    saveTheme(theme)

    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const syncTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media?.matches)
      root.classList.toggle('dark', Boolean(isDark))
      root.setAttribute('data-theme', isDark ? 'dark' : 'light')
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }
    syncTheme()
    media?.addEventListener('change', syncTheme)
    return () => media?.removeEventListener('change', syncTheme)
  }, [state.preferences.theme])

  // Global keyboard shortcuts (Undo/Redo, Code Dialog)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || e.altKey || isEditing(e.target)) return
      const previewShortcut = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p'
      if (previewShortcut && state.export.codeDialogOpen &&
        e.target instanceof HTMLElement && e.target.closest('#code-modal') &&
        !document.querySelector('[role="menu"], [role="listbox"]')) {
        e.preventDefault()
        dispatch({ type: 'SET_CODE_DIALOG_OPEN', payload: false })
        return
      }
      if (hasOpenOverlay()) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // Allow normal undo in inputs
        e.preventDefault()
        if (e.shiftKey) {
          dispatch({ type: 'REDO' })
        } else {
          dispatch({ type: 'UNDO' })
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'y') {
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
  const exportPacks = useMemo(
    () => selectExportPacks(state),
    [state.mode, state.catalog.packs, state.packSelection, state.customGroups.groups],
  )
  const exportItemCount = useMemo(() => exportPacks.reduce((count, pack) => count + pack.items.length, 0), [exportPacks])
  const batchSelectLabel = useMemo(() => selectBatchSelectLabel(state), [state])
  const isClearPacksDisabled = useMemo(() => selectIsClearPacksDisabled(state), [state])
  const activeGroupPickedSrcs = useMemo(() => selectActiveGroupPickedSrcs(state), [state])
  const currentPackExcludedCount = useMemo(() => selectCurrentPackExcludedCount(state), [state])
  const currentPackAllExcluded = useMemo(() => selectCurrentPackAllExcluded(state), [state])
  const isActiveGroupFull = useMemo(() => selectIsActiveGroupFull(state), [state])
  const activeInspectorItem = useMemo(() => selectActiveInspectorItem(state, itemLookup), [state, itemLookup])

  // Dock and preview share one generated result, so shown size/limits match the real download.
  const exportResult = useMemo(() => {
    if (exportPacks.length === 0) {
      return { content: '', filename: '', bytes: 0, error: null as string | null }
    }
    try {
      const generated = generateFormattedExport(state.export.format, exportPacks as any, manifestUrl)
      return {
        content: generated.content,
        filename: generated.filename,
        bytes: new TextEncoder().encode(generated.content).length,
        error: null,
      }
    } catch (err) {
      return {
        content: '',
        filename: '',
        bytes: 0,
        error: exportErrorMessage(err),
      }
    }
  }, [state.export.format, exportPacks, manifestUrl])

  const isOverBudget =
    !exportResult.error &&
    state.export.format === 'smoji' &&
    exportResult.bytes > SMOJI_MANIFEST_MAX_BYTES

  const dismissStorageWarning = useCallback(() => setStorageWarning(null), [])

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
    exportBytes: exportResult.bytes,
    exportContent: exportResult.content,
    exportFilename: exportResult.filename,
    exportError: exportResult.error,
    isOverBudget,
    manifestUrl,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    storageWarning,
    dismissStorageWarning,
    canUndo: state.history.undoStack.length > 0,
    canRedo: state.history.redoStack.length > 0,
  }

  return <WorkbenchContext.Provider value={contextValue}><TooltipProvider delayDuration={400}>{children}</TooltipProvider></WorkbenchContext.Provider>
}
