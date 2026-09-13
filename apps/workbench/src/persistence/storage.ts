import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import {
  loadCopyFormat,
  loadCustomGroupExtensions,
  loadCustomPacks,
  loadDensity,
  loadExcludedSrcs,
  loadExportFormat,
  loadMode,
  loadSelectedPackIds,
  saveCopyFormat,
  saveCustomGroupExtensions,
  saveCustomPacks,
  saveDensity,
  saveExcludedSrcs,
  saveExportFormat,
  saveMode,
  saveSelectedPackIds,
  STORAGE_KEYS,
} from '../storage'
import { initialWorkbenchState, type EditableCustomPack, type Theme, type WorkbenchState } from '../domain/state'
import { selectItemLookupMap } from '../domain/selectors'

export function loadSavedTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch { /* ignore */ }
  return 'system'
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme)
  } catch { /* ignore */ }
}

export function loadInitialState(catalogPacks: readonly SmojiPack[]): WorkbenchState {
  const itemLookup = selectItemLookupMap(catalogPacks)
  const resolveItem = (src: string): SmojiItem | null => itemLookup.get(src) ?? null

  const mode = loadMode()
  const selectedPackIds = loadSelectedPackIds()
  const excludedItemSrcs = loadExcludedSrcs()
  const { packs: customPacks, activeIndex: activeCustomIndex } = loadCustomPacks(resolveItem)
  const comfortableDensity = loadDensity()
  const copyFormat = loadCopyFormat()
  const exportFormat = loadExportFormat()
  const theme = loadSavedTheme()
  const extensions = loadCustomGroupExtensions()
  const notes = (extensions['smoji.workbench'] as { notes?: string } | undefined)?.notes

  return {
    ...initialWorkbenchState,
    mode,
    catalog: {
      ...initialWorkbenchState.catalog,
      packs: catalogPacks,
      status: catalogPacks.length > 0 ? 'ready' : 'idle',
    },
    packSelection: {
      selectedPackIds,
      excludedItemSrcs,
    },
    customGroups: {
      groups: customPacks,
      activeGroupIndex: activeCustomIndex,
      notes,
    },
    gallery: {
      ...initialWorkbenchState.gallery,
      density: comfortableDensity ? 'comfortable' : 'compact',
    },
    inspector: {
      ...initialWorkbenchState.inspector,
      copyFormat,
    },
    export: {
      ...initialWorkbenchState.export,
      format: exportFormat,
    },
    preferences: {
      theme,
    },
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null

export function persistWorkbenchState(state: WorkbenchState): void {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    try {
      saveMode(state.mode)
      saveSelectedPackIds(state.packSelection.selectedPackIds)
      saveExcludedSrcs(state.packSelection.excludedItemSrcs)
      saveCustomPacks(
        state.customGroups.groups.map((g) => ({ ...g, items: [...g.items] })),
        state.customGroups.activeGroupIndex,
      )
      saveDensity(state.gallery.density === 'comfortable')
      saveCopyFormat(state.inspector.copyFormat)
      saveExportFormat(state.export.format as any)
      saveTheme(state.preferences.theme)

      if (state.customGroups.notes) {
        const existing = loadCustomGroupExtensions()
        saveCustomGroupExtensions({
          ...existing,
          'smoji.workbench': {
            ...(existing['smoji.workbench'] as Record<string, unknown> | undefined),
            notes: state.customGroups.notes,
          },
        })
      } else {
        const existing = loadCustomGroupExtensions()
        if (existing['smoji.workbench']) {
          const { notes: _, ...rest } = existing['smoji.workbench'] as Record<string, unknown>
          if (Object.keys(rest).length > 0) {
            existing['smoji.workbench'] = rest
          } else {
            delete existing['smoji.workbench']
          }
          saveCustomGroupExtensions(existing)
        }
      }
    } catch { /* safe storage error */ }
  }, 100)
}
