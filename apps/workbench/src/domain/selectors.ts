import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import { SMOJI_MAX_ITEMS, SMOJI_MAX_ITEMS_PER_PACK } from './limits'
import type { EditableCustomPack, WorkbenchState } from './state'

export function selectActivePack(state: WorkbenchState): SmojiPack | undefined {
  return state.catalog.packs[state.catalog.activePackIndex]
}

export function selectActiveCustomGroup(state: WorkbenchState): EditableCustomPack | undefined {
  return state.customGroups.groups[state.customGroups.activeGroupIndex]
}

export function selectSelectedPacks(state: WorkbenchState): readonly SmojiPack[] {
  return state.catalog.packs.filter((pack) => state.packSelection.selectedPackIds.has(pack.id))
}

export function selectExportPacks(state: WorkbenchState): readonly (SmojiPack | EditableCustomPack)[] {
  if (state.mode === 'packs') {
    const selected = selectSelectedPacks(state)
    const result: SmojiPack[] = []
    for (const pack of selected) {
      const items = pack.items.filter((item) => !state.packSelection.excludedItemSrcs.has(item.src))
      if (items.length > 0) {
        result.push({ ...pack, items })
      }
    }
    return result
  } else {
    return state.customGroups.groups.filter((group) => group.items.length > 0)
  }
}

export function selectExportItemCount(state: WorkbenchState): number {
  const exportPacks = selectExportPacks(state)
  return exportPacks.reduce((acc, p) => acc + p.items.length, 0)
}

export function selectBatchSelectLabel(state: WorkbenchState): '全选' | '反选' {
  return state.packSelection.selectedPackIds.size > 0 ? '反选' : '全选'
}

export function selectIsClearPacksDisabled(state: WorkbenchState): boolean {
  return state.packSelection.selectedPackIds.size === 0
}

export function selectActiveGroupPickedSrcs(state: WorkbenchState): ReadonlySet<string> {
  const activeGroup = selectActiveCustomGroup(state)
  if (!activeGroup) return new Set()
  return new Set(activeGroup.items.map((i) => i.src))
}

export function selectCurrentPackExcludedCount(state: WorkbenchState): number {
  const currentPack = selectActivePack(state)
  if (!currentPack) return 0
  let count = 0
  for (const item of currentPack.items) {
    if (state.packSelection.excludedItemSrcs.has(item.src)) count++
  }
  return count
}

export function selectCurrentPackAllExcluded(state: WorkbenchState): boolean {
  const currentPack = selectActivePack(state)
  if (!currentPack || currentPack.items.length === 0) return false
  return currentPack.items.every((item) => state.packSelection.excludedItemSrcs.has(item.src))
}

export function selectIsActiveGroupFull(state: WorkbenchState): boolean {
  const activeGroup = selectActiveCustomGroup(state)
  if (!activeGroup) return false
  return activeGroup.items.length >= SMOJI_MAX_ITEMS_PER_PACK
}

export function selectTotalCustomItemCount(state: WorkbenchState): number {
  return state.customGroups.groups.reduce((acc, g) => acc + g.items.length, 0)
}

export function selectIsTotalCustomFull(state: WorkbenchState): boolean {
  return selectTotalCustomItemCount(state) >= SMOJI_MAX_ITEMS
}

export function selectItemLookupMap(catalogPacks: readonly SmojiPack[]): Map<string, SmojiItem> {
  const map = new Map<string, SmojiItem>()
  for (const pack of catalogPacks) {
    for (const item of pack.items) {
      if (!map.has(item.src)) {
        map.set(item.src, item)
      }
    }
  }
  return map
}

export function selectActiveInspectorItem(
  state: WorkbenchState,
  itemLookup: Map<string, SmojiItem>,
): { item: SmojiItem; packLabel: string; format: string } | null {
  const src = state.inspector.selectedSrc
  if (!src) return null
  const item = itemLookup.get(src)
  if (!item) return null

  // Find pack or group label
  let packLabel = ''
  if (state.mode === 'packs') {
    const pack = state.catalog.packs.find((p) => p.items.some((i) => i.src === src))
    packLabel = pack?.label ?? '表情'
  } else {
    const group = state.customGroups.groups.find((g) => g.items.some((i) => i.src === src))
    packLabel = group?.label ?? '自选表情'
  }

  const extensionMatch = /\.([a-z0-9]+)$/i.exec(src)
  const format = extensionMatch ? extensionMatch[1]!.toUpperCase() : 'WEBP'

  return { item, packLabel, format }
}
