import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import {
  loadCopyFormat,
  loadCustomGroupExtensions,
  loadCustomPacks,
  loadDensity,
  loadExcludedSrcs,
  loadExportFormat,
  loadMode,
  loadRawCustomPacksBackup,
  loadSelectedPackIds,
  safeStorage,
  saveCopyFormat,
  saveCustomGroupExtensions,
  saveCustomPacks,
  saveDensity,
  saveExcludedSrcs,
  saveExportFormat,
  saveMode,
  saveRawCustomPacksBackup,
  saveSelectedPackIds,
  STORAGE_KEYS,
} from '../storage'
import {
  initialWorkbenchState,
  type CustomGroupExtensions,
  type CustomGroupNotice,
  type Theme,
  type WorkbenchState,
} from '../domain/state'
import { selectItemLookupMap } from '../domain/selectors'
import { canonicalAssetSrc, migratePackSelection, seedAssetPaths } from '../asset-paths'

export function loadSavedTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch { /* ignore */ }
  return 'system'
}

export function saveTheme(theme: Theme): boolean {
  return safeStorage.setItem(STORAGE_KEYS.theme, theme)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function loadInitialState(catalogPacks: readonly SmojiPack[], manifestUrl = new URL('smoji.json', window.location.href).href): WorkbenchState {
  seedAssetPaths(catalogPacks, manifestUrl)
  const itemLookup = selectItemLookupMap(catalogPacks)
  const resolveItem = (src: string): SmojiItem | null => itemLookup.get(canonicalAssetSrc(src, manifestUrl)) ?? null

  const mode = loadMode()
  const selectedPackIds = loadSelectedPackIds()
  const excludedItemSrcs = new Set([...loadExcludedSrcs()].map((src) => canonicalAssetSrc(src, manifestUrl)))
  migratePackSelection(selectedPackIds, excludedItemSrcs, catalogPacks, manifestUrl)
  const { packs: customPacks, activeIndex: activeCustomIndex, unresolved, droppedGroups } = loadCustomPacks(resolveItem)
  const comfortableDensity = loadDensity()
  const copyFormat = loadCopyFormat()
  const exportFormat = loadExportFormat()
  const theme = loadSavedTheme()
  const extensions = loadCustomGroupExtensions()
  const notes = isRecord(extensions['smoji.workbench'])
    ? (extensions['smoji.workbench'] as { notes?: unknown }).notes
    : undefined

  // Keep the pre-migration raw storage once, so unresolved historical items stay recoverable.
  const notice = preserveRawBackup(unresolved, droppedGroups)

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
      notes: typeof notes === 'string' ? notes : undefined,
      extensions,
      notice,
      noticeSeq: notice ? notice.token : 0,
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

function preserveRawBackup(unresolved: number, droppedGroups: number): CustomGroupNotice | null {
  if (unresolved === 0 && droppedGroups === 0) return null
  const raw = safeStorage.getItem(STORAGE_KEYS.customPacks)
  const existing = loadRawCustomPacksBackup()
  if (raw && !existing) {
    saveRawCustomPacksBackup({
      raw,
      savedAt: new Date().toISOString(),
      unresolvedItems: unresolved,
      droppedGroups,
    })
  }
  const parts: string[] = []
  if (unresolved > 0) parts.push(`${unresolved} 张表情无法在当前清单中解析`)
  if (droppedGroups > 0) parts.push(`${droppedGroups} 个分组数据无效`)
  return {
    token: 1,
    tone: 'error',
    message: `恢复自选分组时发现${parts.join('，')}。原始数据已保留备份，可在自选分组面板下载。`,
  }
}

export interface PersistResult {
  ok: boolean
  failures: string[]
}

export function persistWorkbenchState(state: WorkbenchState): PersistResult {
  const failures: string[] = []
  const record = (label: string, ok: boolean) => {
    if (!ok) failures.push(label)
  }

  record('显示模式', saveMode(state.mode))
  record('分类选择', saveSelectedPackIds(state.packSelection.selectedPackIds))
  record('排除项', saveExcludedSrcs(state.packSelection.excludedItemSrcs))
  record(
    '自选分组',
    saveCustomPacks(
      state.customGroups.groups.map((g) => ({ ...g, items: [...g.items] })),
      state.customGroups.activeGroupIndex,
    ),
  )
  record('显示密度', saveDensity(state.gallery.density === 'comfortable'))
  record('复制格式', saveCopyFormat(state.inspector.copyFormat))
  record('导出格式', saveExportFormat(state.export.format as any))
  record('主题', saveTheme(state.preferences.theme))
  record('分组扩展', saveCustomGroupExtensions(extensionsWithNotes(state)))

  return { ok: failures.length === 0, failures }
}

/** The extension bag is the portable store; notes live inside it so backups round-trip. */
export function extensionsWithNotes(state: WorkbenchState): CustomGroupExtensions {
  const current: CustomGroupExtensions = state.customGroups.extensions ?? loadCustomGroupExtensions()
  const next: CustomGroupExtensions = { ...current }
  const workbench = isRecord(next['smoji.workbench']) ? { ...next['smoji.workbench'] } : {}
  if (state.customGroups.notes) workbench.notes = state.customGroups.notes
  else delete workbench.notes
  if (Object.keys(workbench).length > 0) next['smoji.workbench'] = workbench
  else delete next['smoji.workbench']
  return next
}
