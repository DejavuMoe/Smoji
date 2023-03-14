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

const PREFIX = 'smoji-workbench:'

export const STORAGE_KEYS = {
  theme: 'smoji-theme',
  density: `${PREFIX}density`,
  mode: `${PREFIX}mode`,
  customPacks: `${PREFIX}custom-packs`,
  activeCustomIndex: `${PREFIX}active-custom-index`,
  selectedPackIds: `${PREFIX}selected-pack-ids`,
  excludedSrcs: `${PREFIX}excluded-srcs`,
  recentSrcs: `${PREFIX}recent-srcs`,
  copyFormat: `${PREFIX}copy-format`,
  exportFormat: `${PREFIX}export-format`,
  customGroupExtensions: `${PREFIX}custom-group-extensions`,
} as const

export type PersistedCustomPack = {
  id: string
  label: string
  itemSrcs: string[]
}

export type RecentEntry = {
  src: string
  packId: string
  label: string
  at: number
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadDensity(): boolean {
  return localStorage.getItem(STORAGE_KEYS.density) === 'comfortable'
}

export function saveDensity(comfortable: boolean): void {
  localStorage.setItem(STORAGE_KEYS.density, comfortable ? 'comfortable' : 'compact')
}

export function loadMode(): 'packs' | 'custom' {
  const mode = localStorage.getItem(STORAGE_KEYS.mode)
  return mode === 'custom' ? 'custom' : 'packs'
}

export function saveMode(mode: 'packs' | 'custom'): void {
  localStorage.setItem(STORAGE_KEYS.mode, mode)
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

export function loadRecentEntries(limit = 24): RecentEntry[] {
  const entries = readJson<RecentEntry[]>(STORAGE_KEYS.recentSrcs, [])
  return entries
    .filter((e) => e && typeof e.src === 'string' && typeof e.packId === 'string')
    .slice(0, limit)
}

export function pushRecentEntry(
  entry: Omit<RecentEntry, 'at'>,
  limit = 24,
): RecentEntry[] {
  const prev = loadRecentEntries(limit)
  const next = [
    { ...entry, at: Date.now() },
    ...prev.filter((e) => e.src !== entry.src),
  ].slice(0, limit)
  writeJson(STORAGE_KEYS.recentSrcs, next)
  return next
}

export function loadCopyFormat(): 'md' | 'url' | 'html' | 'bbcode' {
  const v = localStorage.getItem(STORAGE_KEYS.copyFormat)
  if (v === 'url' || v === 'html' || v === 'bbcode' || v === 'md') return v
  return 'md'
}

export function saveCopyFormat(format: 'md' | 'url' | 'html' | 'bbcode'): void {
  localStorage.setItem(STORAGE_KEYS.copyFormat, format)
}

export function loadExportFormat(): DockExportFormat {
  const v = localStorage.getItem(STORAGE_KEYS.exportFormat)
  if (v && isDockExportFormat(v)) return v
  return 'smoji'
}

export function saveExportFormat(format: DockExportFormat): void {
  localStorage.setItem(STORAGE_KEYS.exportFormat, format)
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

export function saveCustomPacks(packs: EditableCustomPack[], activeIndex: number): boolean {
  const ok = writeJson(STORAGE_KEYS.customPacks, serializeCustomPacks(packs))
  try {
    localStorage.setItem(STORAGE_KEYS.activeCustomIndex, String(activeIndex))
    return ok
  } catch {
    return false
  }
}

export function loadCustomPacks(
  resolveItem: (src: string) => SmojiItem | null,
): { packs: EditableCustomPack[]; activeIndex: number } {
  const raw = readJson<PersistedCustomPack[]>(STORAGE_KEYS.customPacks, [])
  const packs: EditableCustomPack[] = []
  for (const entry of raw) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.label !== 'string') continue
    if (!Array.isArray(entry.itemSrcs)) continue
    const items: SmojiItem[] = []
    const seen = new Set<string>()
    for (const src of entry.itemSrcs) {
      const item = resolveItem(src)
      if (item && !seen.has(item.src)) {
        items.push(item)
        seen.add(item.src)
      }
    }
    packs.push({ id: entry.id, label: entry.label, items })
  }
  const activeRaw = Number(localStorage.getItem(STORAGE_KEYS.activeCustomIndex) ?? '-1')
  const activeIndex =
    Number.isFinite(activeRaw) && activeRaw >= 0 && activeRaw < packs.length
      ? activeRaw
      : packs.length
        ? 0
        : -1
  return { packs, activeIndex }
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
    return raw as PersistedCustomPack[]
  }
  if (data.kind === 'smoji-custom-groups') {
    if (data.version !== 1) throw new Error('不支持的分组文件版本')
    if (!Array.isArray(data.packs)) throw new Error('分组文件缺少 packs')
    return data.packs as PersistedCustomPack[]
  }
  if (Array.isArray(data.packs)) {
    return data.packs as PersistedCustomPack[]
  }
  throw new Error('无法识别的分组文件格式')
}

