import { SMOJI_ID_PATTERN, isValidSmojiLabel, SMOJI_MAX_PACKS, SMOJI_MAX_ITEMS, SMOJI_MAX_ITEMS_PER_PACK } from '../../../packages/smoji/src/validate'
import { SMOJI_GROUP_BUNDLE_MAX_BYTES } from './domain/limits'
import type { SmojiItem } from 'smoji'
import { isDockExportFormat, type DockExportFormat } from './export'

export type { DockExportFormat }

export interface EditableCustomPack {
  id: string
  label: string
  items: SmojiItem[]
  isEditing?: boolean
  isExpanded?: boolean
}

export const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  setItem(key: string, value: string): boolean {
    try { localStorage.setItem(key, value); return true } catch { return false }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key) } catch { /* Storage may be disabled. */ }
  },
}

const PREFIX = 'smoji-workbench:'

export const STORAGE_KEYS = {
  theme: 'smoji-theme',
  density: `${PREFIX}density`,
  mode: `${PREFIX}mode`,
  customPacks: `${PREFIX}custom-packs`,
  activeCustomIndex: `${PREFIX}active-custom-index`,
  selectedPackIds: `${PREFIX}selected-pack-ids`,
  excludedSrcs: `${PREFIX}excluded-srcs`,
  copyFormat: `${PREFIX}copy-format`,
  exportFormat: `${PREFIX}export-format`,
  customGroupExtensions: `${PREFIX}custom-group-extensions`,
  rawCustomPacksBackup: `${PREFIX}custom-packs-raw-backup`,
} as const

export type PersistedCustomPack = {
  id: string
  label: string
  itemSrcs: string[]
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = safeStorage.getItem(key)
    if (!raw) return fallback
    const value = JSON.parse(raw)
    return Array.isArray(fallback) && !Array.isArray(value) ? fallback : value as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    return safeStorage.setItem(key, JSON.stringify(value))
  } catch {
    return false
  }
}

export function loadDensity(): boolean {
  return safeStorage.getItem(STORAGE_KEYS.density) === 'comfortable'
}

export function saveDensity(comfortable: boolean): boolean {
  return safeStorage.setItem(STORAGE_KEYS.density, comfortable ? 'comfortable' : 'compact')
}

export function loadMode(): 'packs' | 'custom' {
  const mode = safeStorage.getItem(STORAGE_KEYS.mode)
  return mode === 'custom' ? 'custom' : 'packs'
}

export function saveMode(mode: 'packs' | 'custom'): boolean {
  return safeStorage.setItem(STORAGE_KEYS.mode, mode)
}

export function loadSelectedPackIds(): Set<string> {
  const ids = readJson<string[]>(STORAGE_KEYS.selectedPackIds, [])
  return new Set(ids.filter((id) => typeof id === 'string'))
}

export function saveSelectedPackIds(ids: ReadonlySet<string>): boolean {
  return writeJson(STORAGE_KEYS.selectedPackIds, [...ids])
}

export function loadExcludedSrcs(): Set<string> {
  const srcs = readJson<string[]>(STORAGE_KEYS.excludedSrcs, [])
  return new Set(srcs.filter((s) => typeof s === 'string'))
}

export function saveExcludedSrcs(srcs: ReadonlySet<string>): boolean {
  return writeJson(STORAGE_KEYS.excludedSrcs, [...srcs])
}

export function loadCopyFormat(): 'md' | 'url' | 'hugo' | 'html' | 'bbcode' {
  const v = safeStorage.getItem(STORAGE_KEYS.copyFormat)
  if (v === 'hugo' || v === 'url' || v === 'html' || v === 'bbcode' || v === 'md') return v
  return 'md'
}

export function saveCopyFormat(format: 'md' | 'url' | 'hugo' | 'html' | 'bbcode'): boolean {
  return safeStorage.setItem(STORAGE_KEYS.copyFormat, format)
}

export function loadExportFormat(): DockExportFormat {
  const v = safeStorage.getItem(STORAGE_KEYS.exportFormat)
  if (v && isDockExportFormat(v)) return v
  return 'smoji'
}

export function saveExportFormat(format: DockExportFormat): boolean {
  return safeStorage.setItem(STORAGE_KEYS.exportFormat, format)
}

export function loadCustomGroupExtensions(): Record<string, unknown> {
  const raw = readJson<unknown>(STORAGE_KEYS.customGroupExtensions, {})
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, unknown>) }
}

export function saveCustomGroupExtensions(extensions: Record<string, unknown>): boolean {
  return writeJson(STORAGE_KEYS.customGroupExtensions, extensions)
}

export function serializeCustomPacks(packs: EditableCustomPack[]): PersistedCustomPack[] {
  return packs.map((p) => ({
    id: p.id,
    label: p.label,
    itemSrcs: p.items.map((i) => i.src),
  }))
}

/**
 * Shared import/restore normalization: resolve aliases, drop items missing from the current
 * catalog, and de-duplicate by canonical src.
 */
export function resolvePersistedItems(
  itemSrcs: readonly string[],
  resolveItem: (src: string) => SmojiItem | null,
): { items: SmojiItem[]; unresolved: number } {
  const items: SmojiItem[] = []
  const seen = new Set<string>()
  let unresolved = 0
  for (const src of itemSrcs) {
    const item = resolveItem(src)
    if (!item) {
      unresolved++
      continue
    }
    if (seen.has(item.src)) continue
    seen.add(item.src)
    items.push(item)
  }
  return { items, unresolved }
}

export function saveCustomPacks(packs: EditableCustomPack[], activeIndex: number): boolean {
  const ok = writeJson(STORAGE_KEYS.customPacks, serializeCustomPacks(packs))
  try {
    return safeStorage.setItem(STORAGE_KEYS.activeCustomIndex, String(activeIndex)) && ok
  } catch {
    return false
  }
}

export function loadCustomPacks(
  resolveItem: (src: string) => SmojiItem | null,
): { packs: EditableCustomPack[]; activeIndex: number; unresolved: number; droppedGroups: number } {
  const raw = readJson<PersistedCustomPack[]>(STORAGE_KEYS.customPacks, [])
  const packs: EditableCustomPack[] = []
  let total = 0
  let unresolved = 0
  let droppedGroups = 0
  for (const entry of raw) {
    if (!entry || typeof entry.id !== 'string' || !SMOJI_ID_PATTERN.test(entry.id) || !isValidSmojiLabel(entry.label) || packs.some((pack) => pack.id === entry.id)) {
      droppedGroups++
      continue
    }
    if (packs.length >= SMOJI_MAX_PACKS) {
      droppedGroups++
      continue
    }
    if (!Array.isArray(entry.itemSrcs)) {
      droppedGroups++
      continue
    }
    const items: SmojiItem[] = []
    const seen = new Set<string>()
    for (const src of entry.itemSrcs) {
      if (typeof src !== 'string') continue
      if (items.length >= SMOJI_MAX_ITEMS_PER_PACK || total >= SMOJI_MAX_ITEMS) break
      const item = resolveItem(src)
      if (item && !seen.has(item.src)) {
        items.push(item)
        total++
        seen.add(item.src)
      } else if (!item) {
        unresolved++
      }
    }
    packs.push({ id: entry.id, label: entry.label, items })
  }
  const activeRaw = Number(safeStorage.getItem(STORAGE_KEYS.activeCustomIndex) ?? '-1')
  const activeIndex =
    Number.isInteger(activeRaw) && activeRaw >= 0 && activeRaw < packs.length
      ? activeRaw
      : packs.length
        ? 0
        : -1
  return { packs, activeIndex, unresolved, droppedGroups }
}

export interface RawCustomPacksBackup {
  raw: string
  savedAt: string
  unresolvedItems: number
  droppedGroups: number
}

/** Immutable copy of the stored raw groups, written before the first migration can overwrite them. */
export function saveRawCustomPacksBackup(backup: RawCustomPacksBackup): boolean {
  return writeJson(STORAGE_KEYS.rawCustomPacksBackup, backup)
}

export function loadRawCustomPacksBackup(): RawCustomPacksBackup | null {
  const value = readJson<RawCustomPacksBackup | null>(STORAGE_KEYS.rawCustomPacksBackup, null)
  if (!value || typeof value.raw !== 'string' || typeof value.savedAt !== 'string') return null
  return {
    raw: value.raw,
    savedAt: value.savedAt,
    unresolvedItems: Number(value.unresolvedItems) || 0,
    droppedGroups: Number(value.droppedGroups) || 0,
  }
}

/** Portable custom-group bundle for import/export (future pack expansion). */
export interface CustomGroupBundle {
  version: 1
  kind: 'smoji-custom-groups'
  exportedAt: string
  packs: PersistedCustomPack[]
  /** Reserved for forward-compatible pack-group plugins; v1 parsers ignore this. */
  extensions?: Record<string, unknown>
}

export function buildCustomGroupBundle(
  packs: EditableCustomPack[],
  extensions?: Record<string, unknown>,
): CustomGroupBundle {
  const bundle: CustomGroupBundle = {
    version: 1,
    kind: 'smoji-custom-groups',
    exportedAt: new Date().toISOString(),
    packs: serializeCustomPacks(packs),
  }
  if (extensions && Object.keys(extensions).length > 0) {
    bundle.extensions = { ...extensions }
  }
  return bundle
}

/** Extract forward-compat extension bag without rejecting unknown top-level keys. */
export function parseCustomGroupExtensions(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const data = raw as Record<string, unknown>
  if (!data.extensions || typeof data.extensions !== 'object' || Array.isArray(data.extensions)) {
    return undefined
  }
  return { ...(data.extensions as Record<string, unknown>) }
}

export function parseCustomGroupBundle(raw: unknown): PersistedCustomPack[] {
  if (!raw || typeof raw !== 'object') throw new Error('无效的分组文件')
  const data = raw as Record<string, unknown>
  if (Array.isArray(raw)) {
    return validatePersistedPacks(raw)
  }
  if (data.kind === 'smoji-custom-groups') {
    if (data.version !== 1) throw new Error('不支持的分组文件版本')
    if (!Array.isArray(data.packs)) throw new Error('分组文件缺少 packs')
    return validatePersistedPacks(data.packs)
  }
  if (Array.isArray(data.packs)) {
    return validatePersistedPacks(data.packs)
  }
  throw new Error('无法识别的分组文件格式')
}


function validatePersistedPacks(raw: unknown[]): PersistedCustomPack[] {
  let total = 0
  const ids = new Set<string>()
  if (raw.length > SMOJI_MAX_PACKS) throw new Error('分组数超出上限')
  for (const value of raw) {
    const entry = value as PersistedCustomPack | null
    if (!entry || typeof entry.id !== 'string' || !SMOJI_ID_PATTERN.test(entry.id)
      || ids.has(entry.id) || !isValidSmojiLabel(entry.label) || !Array.isArray(entry.itemSrcs)
      || entry.itemSrcs.some((src) => typeof src !== 'string' || !src.trim())
      || entry.itemSrcs.length > SMOJI_MAX_ITEMS_PER_PACK) throw new Error('无效的分组数据')
    ids.add(entry.id)
    total += entry.itemSrcs.length
  }
  if (total > SMOJI_MAX_ITEMS) throw new Error('表情总数超出上限')
  return raw as PersistedCustomPack[]
}

/** Bound the read before parsing: a backup bundle embeds absolute srcs, so it gets its own budget. */
export function assertCustomGroupBundleSize(text: string): void {
  if (
    text.length > SMOJI_GROUP_BUNDLE_MAX_BYTES ||
    new TextEncoder().encode(text).length > SMOJI_GROUP_BUNDLE_MAX_BYTES
  ) {
    throw new Error('分组备份文件超过 4MB 上限，请拆分后再导入')
  }
}
