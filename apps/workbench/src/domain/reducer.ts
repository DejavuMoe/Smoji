import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import { isValidSmojiLabel, SMOJI_ID_PATTERN } from '../../../../packages/smoji/src/validate'
import type { WorkbenchAction } from './actions'
import {
  HISTORY_CAPACITY,
  SMOJI_MAX_ITEMS,
  SMOJI_MAX_ITEMS_PER_PACK,
  SMOJI_MAX_PACKS,
} from './limits'
import type { CustomGroupExtensions, CustomGroupTransaction, EditableCustomPack, WorkbenchState } from './state'

/** Core labels are validated with `isValidSmojiLabel` (1–40 display characters, no `]`/controls). */
const MAX_LABEL_LENGTH = 40
const MAX_GROUP_ID_BASE = 48

function groupIdBase(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, MAX_GROUP_ID_BASE)
  return cleaned || 'group'
}

function uniqueGroupId(existing: ReadonlySet<string>, base: string): string {
  let id = base
  let counter = 1
  while (existing.has(id)) {
    const suffix = `-${counter++}`
    id = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`
  }
  return id
}

function generateGroupId(existingGroups: readonly EditableCustomPack[], base = 'custom'): string {
  return uniqueGroupId(new Set(existingGroups.map((group) => group.id)), groupIdBase(base))
}

/**
 * Import keeps a valid, non-conflicting ID verbatim (it is a stable identifier in backups and
 * Smoji groups). Only conflicts or invalid IDs fall back to a suffixed variant.
 */
function resolveImportedGroupId(existing: ReadonlySet<string>, preferred: string): string {
  const trimmed = preferred.trim()
  if (SMOJI_ID_PATTERN.test(trimmed) && !existing.has(trimmed)) return trimmed
  const base = SMOJI_ID_PATTERN.test(trimmed) ? trimmed.slice(0, MAX_GROUP_ID_BASE) : groupIdBase(trimmed)
  return uniqueGroupId(existing, base)
}

/** Derived names (duplicate/split) must still satisfy the core label limit. */
function derivedLabel(base: string, suffix: string): string {
  const chars = Array.from(base)
  const available = Math.max(1, MAX_LABEL_LENGTH - Array.from(suffix).length)
  return `${chars.slice(0, available).join('').trim()}${suffix}`
}

function mergeExtensionBags(
  current: CustomGroupExtensions,
  incoming: CustomGroupExtensions,
): CustomGroupExtensions {
  const next: CustomGroupExtensions = { ...current }
  for (const [id, value] of Object.entries(incoming)) {
    const previous = next[id]
    const plain = (input: unknown): input is Record<string, unknown> =>
      Boolean(input) && typeof input === 'object' && !Array.isArray(input)
    next[id] = plain(previous) && plain(value) ? { ...previous, ...value } : value
  }
  return next
}

function nextNoticeToken(state: WorkbenchState): number {
  return (state.customGroups.noticeSeq ?? 0) + 1
}

/** Single rejection channel: the UI toasts the notice instead of guessing from unchanged state. */
function reject(state: WorkbenchState, message: string): WorkbenchState {
  const token = nextNoticeToken(state)
  return {
    ...state,
    customGroups: {
      ...state.customGroups,
      notice: { token, tone: 'error', message },
      noticeSeq: token,
    },
  }
}

function capacityMessage(nextGroups: readonly EditableCustomPack[]): string {
  if (nextGroups.length > SMOJI_MAX_PACKS) return `分组数量已达上限 ${SMOJI_MAX_PACKS} 个`
  if (nextGroups.some((group) => group.items.length > SMOJI_MAX_ITEMS_PER_PACK)) {
    return `单个分组最多 ${SMOJI_MAX_ITEMS_PER_PACK} 张表情`
  }
  return `全部自选分组合计最多 ${SMOJI_MAX_ITEMS} 张表情`
}

function commitTransaction(
  state: WorkbenchState,
  description: string,
  nextGroups: readonly EditableCustomPack[],
  nextActiveIndex: number,
  options: { notes?: string; extensions?: CustomGroupExtensions; notice?: string } = {},
): WorkbenchState {
  if (
    nextGroups.length > SMOJI_MAX_PACKS ||
    nextGroups.some((group) => group.items.length > SMOJI_MAX_ITEMS_PER_PACK) ||
    nextGroups.reduce((count, group) => count + group.items.length, 0) > SMOJI_MAX_ITEMS
  ) return reject(state, capacityMessage(nextGroups))

  const currentSnapshot: CustomGroupTransaction = {
    groups: state.customGroups.groups,
    activeGroupIndex: state.customGroups.activeGroupIndex,
    description,
    notes: state.customGroups.notes,
    extensions: state.customGroups.extensions,
  }
  const nextUndo = [currentSnapshot, ...state.history.undoStack].slice(0, HISTORY_CAPACITY)
  const noticeToken = options.notice ? nextNoticeToken(state) : (state.customGroups.noticeSeq ?? 0)
  return {
    ...state,
    customGroups: {
      ...state.customGroups,
      groups: nextGroups,
      activeGroupIndex: nextActiveIndex,
      notes: options.notes !== undefined ? options.notes : state.customGroups.notes,
      extensions: options.extensions !== undefined ? options.extensions : state.customGroups.extensions,
      notice: options.notice
        ? { token: noticeToken, tone: 'info', message: options.notice }
        : state.customGroups.notice,
      noticeSeq: noticeToken,
    },
    history: {
      undoStack: nextUndo,
      redoStack: [],
    },
  }
}

function withNotes(state: WorkbenchState, notes: string): WorkbenchState {
  const extensions: CustomGroupExtensions = { ...(state.customGroups.extensions ?? {}) }
  const current = extensions['smoji.workbench']
  const workbench =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {}
  if (notes) workbench.notes = notes
  else delete workbench.notes
  if (Object.keys(workbench).length > 0) extensions['smoji.workbench'] = workbench
  else delete extensions['smoji.workbench']
  return {
    ...state,
    customGroups: {
      ...state.customGroups,
      notes,
      extensions,
    },
  }
}

/** After removing an item, move the inspector to a neighbor instead of stranding a stale selection. */
function selectionAfterRemoval(
  state: WorkbenchState,
  removed: SmojiItem,
  remaining: readonly SmojiItem[],
  removedIndex: number,
  groupIndex: number,
): string | null {
  // Source-gallery previews remain valid after removing group membership. Only the picked
  // gallery loses the item itself and needs to advance or close.
  if (state.gallery.view !== 'picked' || groupIndex !== state.customGroups.activeGroupIndex || state.inspector.selectedSrc !== removed.src) return state.inspector.selectedSrc
  if (remaining.length === 0) return null
  return remaining[Math.min(removedIndex, remaining.length - 1)]?.src ?? null
}

function toggleCustomItem(
  state: WorkbenchState,
  item: SmojiItem,
  requestedIndex?: number,
): WorkbenchState {
  const groups = [...state.customGroups.groups]
  let targetIndex = requestedIndex ?? state.customGroups.activeGroupIndex

  // Auto-create default group if none exists
  if (groups.length === 0) {
    groups.push({ id: 'favorites', label: '常用', items: [] })
    targetIndex = 0
  } else if (targetIndex < 0 || targetIndex >= groups.length) {
    targetIndex = 0
  }

  const currentGroup = groups[targetIndex]!
  const existsIndex = currentGroup.items.findIndex((entry) => entry.src === item.src)

  if (existsIndex !== -1) {
    const nextItems = currentGroup.items.filter((_, index) => index !== existsIndex)
    groups[targetIndex] = { ...currentGroup, items: nextItems }
    const nextSelected = selectionAfterRemoval(state, item, nextItems, existsIndex, targetIndex)
    const nextState = commitTransaction(state, `移出表情「${item.label}」`, groups, targetIndex)
    if (nextSelected === nextState.inspector.selectedSrc) return nextState
    return { ...nextState, inspector: { ...nextState.inspector, selectedSrc: nextSelected } }
  }

  if (currentGroup.items.length >= SMOJI_MAX_ITEMS_PER_PACK) {
    return reject(state, `「${currentGroup.label}」已达 ${SMOJI_MAX_ITEMS_PER_PACK} 张上限`)
  }
  const totalItems = groups.reduce((count, group) => count + group.items.length, 0)
  if (totalItems >= SMOJI_MAX_ITEMS) return reject(state, capacityMessage(groups))
  groups[targetIndex] = { ...currentGroup, items: [...currentGroup.items, item] }
  return commitTransaction(state, `添加表情「${item.label}」`, groups, targetIndex)
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'SET_MODE': {
      return {
        ...state,
        mode: action.payload,
      }
    }

    case 'SET_CATALOG_PACKS': {
      const packs = action.payload
      const activePackIndex =
        state.catalog.activePackIndex >= 0 && state.catalog.activePackIndex < packs.length
          ? state.catalog.activePackIndex
          : 0
      return {
        ...state,
        catalog: {
          ...state.catalog,
          packs,
          activePackIndex,
          status: 'ready',
        },
      }
    }

    case 'SET_CATALOG_STATUS': {
      return {
        ...state,
        catalog: {
          ...state.catalog,
          status: action.payload.status,
          error: action.payload.error,
        },
      }
    }

    case 'SET_ACTIVE_PACK': {
      if (action.payload < 0 || action.payload >= state.catalog.packs.length) return state
      return {
        ...state,
        catalog: {
          ...state.catalog,
          activePackIndex: action.payload,
        },
        gallery: {
          ...state.gallery,
          renderLimit: 72,
        },
      }
    }

    case 'TOGGLE_PACK_SELECTION': {
      const id = action.payload
      const next = new Set(state.packSelection.selectedPackIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          selectedPackIds: next,
        },
      }
    }

    case 'SELECT_ALL_PACKS': {
      const allIds = state.catalog.packs.map((p) => p.id)
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          selectedPackIds: new Set(allIds),
        },
      }
    }

    case 'INVERT_PACK_SELECTION': {
      const next = new Set<string>()
      for (const pack of state.catalog.packs) {
        if (!state.packSelection.selectedPackIds.has(pack.id)) {
          next.add(pack.id)
        }
      }
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          selectedPackIds: next,
        },
      }
    }

    // Dynamic "全选 / 反选" contract:
    // 0 selected => select all
    // 1+ selected => invert selection against catalog packs (Set complement)
    case 'BATCH_SELECT_PACKS': {
      if (state.packSelection.selectedPackIds.size === 0) {
        return workbenchReducer(state, { type: 'SELECT_ALL_PACKS' })
      }
      return workbenchReducer(state, { type: 'INVERT_PACK_SELECTION' })
    }

    case 'CLEAR_PACK_SELECTION': {
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          selectedPackIds: new Set(),
        },
      }
    }

    case 'EXCLUDE_PACK_ITEM': {
      const next = new Set(state.packSelection.excludedItemSrcs)
      next.add(action.payload)
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          excludedItemSrcs: next,
        },
      }
    }

    case 'RESTORE_PACK_ITEM': {
      const next = new Set(state.packSelection.excludedItemSrcs)
      next.delete(action.payload)
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          excludedItemSrcs: next,
        },
      }
    }

    case 'TOGGLE_PACK_ITEM_EXCLUSION': {
      const src = action.payload
      const next = new Set(state.packSelection.excludedItemSrcs)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          excludedItemSrcs: next,
        },
      }
    }

    case 'EXCLUDE_CURRENT_PACK_ALL': {
      const currentPack = state.catalog.packs[state.catalog.activePackIndex]
      if (!currentPack) return state
      const next = new Set(state.packSelection.excludedItemSrcs)
      for (const item of currentPack.items) {
        next.add(item.src)
      }
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          excludedItemSrcs: next,
        },
      }
    }

    case 'RESTORE_CURRENT_PACK_ALL': {
      const currentPack = state.catalog.packs[state.catalog.activePackIndex]
      if (!currentPack) return state
      const next = new Set(state.packSelection.excludedItemSrcs)
      for (const item of currentPack.items) {
        next.delete(item.src)
      }
      return {
        ...state,
        packSelection: {
          ...state.packSelection,
          excludedItemSrcs: next,
        },
      }
    }

    case 'SET_CUSTOM_GROUPS': {
      const groups = action.payload.groups
      const activeGroupIndex =
        action.payload.activeGroupIndex !== undefined
          ? action.payload.activeGroupIndex
          : groups.length > 0
            ? 0
            : -1
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          groups,
          activeGroupIndex,
        },
      }
    }

    case 'SET_ACTIVE_CUSTOM_GROUP': {
      const index = action.payload
      if (index < 0 || index >= state.customGroups.groups.length) return state
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          activeGroupIndex: index,
        },
        gallery: {
          ...state.gallery,
          renderLimit: 72,
        },
      }
    }

    case 'CREATE_CUSTOM_GROUP': {
      const label = action.payload.label.trim()
      if (!isValidSmojiLabel(label)) {
        return reject(state, '分组名称需为 1–40 个字符，且不能包含 ] 或控制字符')
      }
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) {
        return reject(state, `分组数量已达上限 ${SMOJI_MAX_PACKS} 个`)
      }
      const existing = new Set(state.customGroups.groups.map((group) => group.id))
      const requestedId = action.payload.id?.trim()
      if (requestedId !== undefined && requestedId !== '') {
        if (!SMOJI_ID_PATTERN.test(requestedId)) {
          return reject(state, '分组 ID 需以字母或数字开头，仅含字母、数字、点、下划线和连字符')
        }
        if (existing.has(requestedId)) return reject(state, `分组 ID「${requestedId}」已存在`)
      }
      const id = requestedId ? requestedId : generateGroupId(state.customGroups.groups, label)
      const newGroup: EditableCustomPack = { id, label, items: [] }
      const nextGroups = [...state.customGroups.groups, newGroup]
      const nextActiveIndex = nextGroups.length - 1
      return commitTransaction(state, `创建分组「${label}」`, nextGroups, nextActiveIndex)
    }

    case 'RENAME_CUSTOM_GROUP': {
      const { index, label } = action.payload
      const trimmed = label.trim()
      if (!isValidSmojiLabel(trimmed)) {
        return reject(state, '分组名称需为 1–40 个字符，且不能包含 ] 或控制字符')
      }
      if (index < 0 || index >= state.customGroups.groups.length) return state
      const target = state.customGroups.groups[index]!
      if (target.label === trimmed) return state
      const nextGroups = state.customGroups.groups.map((g, i) =>
        i === index ? { ...g, label: trimmed } : g,
      )
      return commitTransaction(state, `重命名分组「${trimmed}」`, nextGroups, state.customGroups.activeGroupIndex)
    }

    case 'SET_CUSTOM_GROUP_ID': {
      const { index } = action.payload
      const id = action.payload.id.trim()
      if (!SMOJI_ID_PATTERN.test(id)) {
        return reject(state, '分组 ID 需以字母或数字开头，仅含字母、数字、点、下划线和连字符')
      }
      if (index < 0 || index >= state.customGroups.groups.length) return state
      if (state.customGroups.groups.some((group, i) => i !== index && group.id === id)) {
        return reject(state, `分组 ID「${id}」已存在`)
      }
      const target = state.customGroups.groups[index]!
      if (target.id === id) return state
      const nextGroups = state.customGroups.groups.map((g, i) => (i === index ? { ...g, id } : g))
      return commitTransaction(state, `修改分组 ID 为「${id}」`, nextGroups, state.customGroups.activeGroupIndex)
    }

    case 'DELETE_CUSTOM_GROUP': {
      const index = action.payload
      if (index < 0 || index >= state.customGroups.groups.length) return state
      const target = state.customGroups.groups[index]!
      const nextGroups = state.customGroups.groups.filter((_, i) => i !== index)
      let nextActiveIndex = state.customGroups.activeGroupIndex
      if (index < nextActiveIndex) nextActiveIndex--
      if (nextActiveIndex >= nextGroups.length) {
        nextActiveIndex = nextGroups.length - 1
      }
      return commitTransaction(state, `删除分组「${target.label}」`, nextGroups, nextActiveIndex)
    }

    case 'REORDER_CUSTOM_GROUPS': {
      const { fromIndex, toIndex } = action.payload
      const groups = [...state.customGroups.groups]
      if (
        fromIndex < 0 ||
        fromIndex >= groups.length ||
        toIndex < 0 ||
        toIndex >= groups.length ||
        fromIndex === toIndex
      ) {
        return state
      }
      const [moved] = groups.splice(fromIndex, 1)
      if (!moved) return state
      groups.splice(toIndex, 0, moved)

      let nextActive = state.customGroups.activeGroupIndex
      if (nextActive === fromIndex) nextActive = toIndex
      else if (fromIndex < nextActive && toIndex >= nextActive) nextActive--
      else if (fromIndex > nextActive && toIndex <= nextActive) nextActive++

      return commitTransaction(state, '调整分组顺序', groups, nextActive)
    }

    case 'MOVE_CUSTOM_GROUP': {
      const { index, direction } = action.payload
      const targetIndex = index + direction
      return workbenchReducer(state, {
        type: 'REORDER_CUSTOM_GROUPS',
        payload: { fromIndex: index, toIndex: targetIndex },
      })
    }

    case 'DUPLICATE_CUSTOM_GROUP': {
      const index = action.payload
      if (index < 0 || index >= state.customGroups.groups.length) return state
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) {
        return reject(state, `分组数量已达上限 ${SMOJI_MAX_PACKS} 个`)
      }
      const source = state.customGroups.groups[index]!
      const label = derivedLabel(source.label, ' (副本)')
      const id = uniqueGroupId(new Set(state.customGroups.groups.map((g) => g.id)), source.id)
      const duplicate: EditableCustomPack = {
        id,
        label,
        items: [...source.items],
      }
      const groups = [...state.customGroups.groups]
      groups.splice(index + 1, 0, duplicate)
      return commitTransaction(state, `复制分组「${source.label}」`, groups, index + 1)
    }

    case 'MERGE_CUSTOM_GROUP': {
      const index = action.payload
      if (index <= 0 || index >= state.customGroups.groups.length) return state
      const prev = state.customGroups.groups[index - 1]!
      const curr = state.customGroups.groups[index]!
      const seen = new Set(prev.items.map((i) => i.src))
      const combined = [...prev.items]
      for (const item of curr.items) {
        if (!seen.has(item.src)) {
          combined.push(item)
          seen.add(item.src)
        }
      }
      const updatedPrev: EditableCustomPack = {
        ...prev,
        items: combined,
      }
      const groups = state.customGroups.groups
        .filter((_, i) => i !== index)
        .map((g, i) => (i === index - 1 ? updatedPrev : g))
      let nextActive = state.customGroups.activeGroupIndex
      if (nextActive >= index) nextActive = Math.max(0, nextActive - 1)
      return commitTransaction(state, `合并分组「${curr.label}」到「${prev.label}」`, groups, nextActive)
    }

    case 'SPLIT_CUSTOM_GROUP': {
      const index = action.payload
      if (index < 0 || index >= state.customGroups.groups.length) return state
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) {
        return reject(state, `分组数量已达上限 ${SMOJI_MAX_PACKS} 个`)
      }
      const target = state.customGroups.groups[index]!
      if (target.items.length < 2) return state
      const half = Math.ceil(target.items.length / 2)
      const firstItems = target.items.slice(0, half)
      const secondItems = target.items.slice(half)
      const first: EditableCustomPack = { ...target, items: firstItems }
      const secondLabel = derivedLabel(target.label, ' (2)')
      const secondId = uniqueGroupId(
        new Set(state.customGroups.groups.map((g) => g.id)),
        `${target.id}-split`.slice(0, MAX_GROUP_ID_BASE),
      )
      const second: EditableCustomPack = { id: secondId, label: secondLabel, items: secondItems }
      const groups = [...state.customGroups.groups]
      groups.splice(index, 1, first, second)
      return commitTransaction(state, `拆分分组「${target.label}」`, groups, index)
    }

    case 'TOGGLE_CUSTOM_ITEM': {
      return toggleCustomItem(state, action.payload)
    }

    case 'TOGGLE_CUSTOM_ITEM_IN_GROUP': {
      return toggleCustomItem(state, action.payload.item, action.payload.groupIndex)
    }

    case 'REMOVE_CUSTOM_ITEM': {
      const { groupIndex, itemIndex } = action.payload
      if (groupIndex < 0 || groupIndex >= state.customGroups.groups.length) return state
      const targetGroup = state.customGroups.groups[groupIndex]!
      if (itemIndex < 0 || itemIndex >= targetGroup.items.length) return state
      const removed = targetGroup.items[itemIndex]!
      const nextItems = targetGroup.items.filter((_, i) => i !== itemIndex)
      const nextGroups = state.customGroups.groups.map((g, i) =>
        i === groupIndex ? { ...g, items: nextItems } : g,
      )
      const nextSelected = selectionAfterRemoval(state, removed, nextItems, itemIndex, groupIndex)
      const nextState = commitTransaction(state, `移出表情「${removed.label}」`, nextGroups, state.customGroups.activeGroupIndex)
      if (nextSelected === nextState.inspector.selectedSrc) return nextState
      return { ...nextState, inspector: { ...nextState.inspector, selectedSrc: nextSelected } }
    }

    case 'REORDER_CUSTOM_ITEMS': {
      const { groupIndex, fromIndex, toIndex } = action.payload
      if (groupIndex < 0 || groupIndex >= state.customGroups.groups.length) return state
      const group = state.customGroups.groups[groupIndex]!
      if (
        fromIndex < 0 ||
        fromIndex >= group.items.length ||
        toIndex < 0 ||
        toIndex >= group.items.length ||
        fromIndex === toIndex
      ) {
        return state
      }
      const items = [...group.items]
      const [moved] = items.splice(fromIndex, 1)
      if (!moved) return state
      items.splice(toIndex, 0, moved)
      const nextGroups = state.customGroups.groups.map((g, i) =>
        i === groupIndex ? { ...g, items } : g,
      )
      return commitTransaction(state, '调整分组内表情排序', nextGroups, state.customGroups.activeGroupIndex)
    }

    case 'MOVE_CUSTOM_ITEM_TO_GROUP': {
      const { itemSrc, targetGroupIndex, sourceGroupIndex, sourceItemIndex } = action.payload
      if (targetGroupIndex < 0 || targetGroupIndex >= state.customGroups.groups.length) return state
      const targetGroup = state.customGroups.groups[targetGroupIndex]!
      if (targetGroup.items.some((i) => i.src === itemSrc)) {
        return sourceGroupIndex === undefined
          ? state
          : reject(state, `「${targetGroup.label}」中已存在该表情`)
      }
      if (targetGroup.items.length >= SMOJI_MAX_ITEMS_PER_PACK) {
        return reject(state, `「${targetGroup.label}」已达 ${SMOJI_MAX_ITEMS_PER_PACK} 张上限`)
      }

      let foundItem: SmojiItem | undefined
      let fromIndex = -1
      if (sourceGroupIndex !== undefined) {
        const sourceGroup = state.customGroups.groups[sourceGroupIndex]
        if (!sourceGroup) return state
        const index = sourceItemIndex ?? sourceGroup.items.findIndex((i) => i.src === itemSrc)
        if (index < 0 || index >= sourceGroup.items.length || sourceGroup.items[index]?.src !== itemSrc) {
          return state
        }
        foundItem = sourceGroup.items[index]!
        fromIndex = index
      } else {
        for (const pack of state.catalog.packs) {
          const item = pack.items.find((i) => i.src === itemSrc)
          if (item) {
            foundItem = item
            break
          }
        }
        if (!foundItem) {
          for (const group of state.customGroups.groups) {
            const item = group.items.find((i) => i.src === itemSrc)
            if (item) {
              foundItem = item
              break
            }
          }
        }
        const totalItems = state.customGroups.groups.reduce((count, group) => count + group.items.length, 0)
        if (totalItems >= SMOJI_MAX_ITEMS) return reject(state, capacityMessage(state.customGroups.groups))
      }
      if (!foundItem) return state

      const moving = sourceGroupIndex !== undefined
      const nextGroups = state.customGroups.groups.map((group, index) => {
        if (moving && index === sourceGroupIndex) {
          return { ...group, items: group.items.filter((_, i) => i !== fromIndex) }
        }
        if (index === targetGroupIndex) {
          return { ...group, items: [...group.items, foundItem!] }
        }
        return group
      })
      return commitTransaction(
        state,
        moving
          ? `移动表情到「${targetGroup.label}」`
          : `添加表情到「${targetGroup.label}」`,
        nextGroups,
        state.customGroups.activeGroupIndex,
      )
    }

    case 'ADD_ALL_CURRENT_PACK_TO_CUSTOM': {
      const currentPack = state.catalog.packs[state.catalog.activePackIndex]
      if (!currentPack) return state
      let groups = [...state.customGroups.groups]
      let targetIndex = state.customGroups.activeGroupIndex
      if (groups.length === 0) {
        groups = [{ id: 'favorites', label: '常用', items: [] }]
        targetIndex = 0
      } else if (targetIndex < 0 || targetIndex >= groups.length) {
        targetIndex = 0
      }

      const targetGroup = groups[targetIndex]!
      const seen = new Set(targetGroup.items.map((i) => i.src))
      const added: SmojiItem[] = []
      // Custom mode never surfaces pack exclusions, so batch add must not inherit that hidden state.
      for (const item of currentPack.items) {
        if (seen.has(item.src)) continue
        if (
          targetGroup.items.length + added.length < SMOJI_MAX_ITEMS_PER_PACK &&
          groups.reduce((count, g) => count + g.items.length, 0) + added.length < SMOJI_MAX_ITEMS
        ) {
          added.push(item)
          seen.add(item.src)
        }
      }
      if (added.length === 0) {
        const allPresent = currentPack.items.every((item) => seen.has(item.src))
        return allPresent ? state : reject(state, `「${targetGroup.label}」容量不足，未能加入任何表情`)
      }

      groups[targetIndex] = { ...targetGroup, items: [...targetGroup.items, ...added] }
      const notice = added.length < currentPack.items.length
        ? `已加入 ${added.length} 张，跳过 ${currentPack.items.length - added.length} 张（已存在或超出容量上限）`
        : undefined
      return commitTransaction(
        state,
        `批量添加「${currentPack.label}」到「${targetGroup.label}」`,
        groups,
        targetIndex,
        notice ? { notice } : {},
      )
    }

    case 'IMPORT_CUSTOM_GROUPS': {
      const { groups: imported, notes, extensions } = action.payload
      if (imported.length === 0) return reject(state, '导入文件不包含任何分组')
      const nextGroups = [...state.customGroups.groups]
      const existing = new Set(nextGroups.map((group) => group.id))
      let renamed = 0
      for (const group of imported) {
        const id = resolveImportedGroupId(existing, group.id)
        if (id !== group.id) renamed++
        existing.add(id)
        nextGroups.push({ ...group, id })
      }
      const nextActive = state.customGroups.activeGroupIndex >= 0 ? state.customGroups.activeGroupIndex : 0
      const mergedExtensions = extensions
        ? mergeExtensionBags(state.customGroups.extensions ?? {}, extensions)
        : undefined
      return commitTransaction(state, '导入分组配置', nextGroups, nextActive, {
        ...(notes !== undefined ? { notes } : {}),
        ...(mergedExtensions !== undefined ? { extensions: mergedExtensions } : {}),
        notice:
          renamed > 0
            ? `已导入 ${imported.length} 个分组，其中 ${renamed} 个 ID 冲突已重命名`
            : `已导入 ${imported.length} 个分组`,
      })
    }

    case 'CLEAR_ALL_CUSTOM_GROUPS': {
      if (state.customGroups.groups.length === 0) return state
      return commitTransaction(state, '清空所有自选分组', [], -1, { notice: '已清空所有自选分组' })
    }

    case 'SET_CUSTOM_NOTES': {
      if (state.customGroups.notes === action.payload) return state
      return withNotes(state, action.payload)
    }

    case 'SET_CUSTOM_EXTENSIONS': {
      const extensions = { ...action.payload }
      const workbench = extensions['smoji.workbench']
      const notes =
        workbench && typeof workbench === 'object' && !Array.isArray(workbench)
          ? (workbench as { notes?: unknown }).notes
          : undefined
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          extensions,
          notes: typeof notes === 'string' ? notes : undefined,
        },
      }
    }

    case 'CLEAR_CUSTOM_GROUP_NOTICE': {
      if (!state.customGroups.notice) return state
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          notice: null,
        },
      }
    }

    case 'SET_GALLERY_VIEW': {
      return {
        ...state,
        gallery: {
          ...state.gallery,
          view: action.payload,
          renderLimit: 72,
        },
      }
    }

    case 'SET_GALLERY_DENSITY': {
      return {
        ...state,
        gallery: {
          ...state.gallery,
          density: action.payload,
        },
      }
    }

    case 'EXPAND_RENDER_LIMIT': {
      return {
        ...state,
        gallery: {
          ...state.gallery,
          renderLimit: state.gallery.renderLimit + 72,
        },
      }
    }

    case 'OPEN_INSPECTOR': {
      return {
        ...state,
        inspector: {
          ...state.inspector,
          selectedSrc: action.payload,
        },
      }
    }

    case 'CLOSE_INSPECTOR': {
      return {
        ...state,
        inspector: {
          ...state.inspector,
          selectedSrc: null,
        },
      }
    }

    case 'NAVIGATE_INSPECTOR': {
      const direction = action.payload
      const selectedSrc = state.inspector.selectedSrc
      if (!selectedSrc) return state

      let items: readonly SmojiItem[] = []
      if (state.mode === 'packs') {
        const pack = state.catalog.packs[state.catalog.activePackIndex]
        items = pack?.items ?? []
      } else {
        if (state.gallery.view === 'picked') {
          const group = state.customGroups.groups[state.customGroups.activeGroupIndex]
          items = group?.items ?? []
        } else {
          const pack = state.catalog.packs[state.catalog.activePackIndex]
          items = pack?.items ?? []
        }
      }
      if (items.length === 0) return state
      // A removed selection no longer exists in the list: continue from the first item instead of dead-ending.
      const currentIndex = items.findIndex((i) => i.src === selectedSrc)
      if (currentIndex === -1) {
        const fallback = items[0]
        if (!fallback) return state
        return { ...state, inspector: { ...state.inspector, selectedSrc: fallback.src } }
      }

      const nextIndex =
        direction === 'next'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length
      const nextItem = items[nextIndex]
      if (!nextItem) return state

      return {
        ...state,
        inspector: {
          ...state.inspector,
          selectedSrc: nextItem.src,
        },
      }
    }

    case 'SET_INSPECTOR_COPY_FORMAT': {
      return {
        ...state,
        inspector: {
          ...state.inspector,
          copyFormat: action.payload,
        },
      }
    }

    case 'SET_INSPECTOR_BG': {
      return {
        ...state,
        inspector: {
          ...state.inspector,
          previewBackground: action.payload,
        },
      }
    }

    case 'SET_EXPORT_FORMAT': {
      return {
        ...state,
        export: {
          ...state.export,
          format: action.payload,
        },
      }
    }

    case 'SET_EXPORT_PREVIEW_SCOPE': {
      return {
        ...state,
        export: {
          ...state.export,
          previewScope: action.payload,
        },
      }
    }

    case 'SET_CODE_DIALOG_OPEN': {
      return {
        ...state,
        export: {
          ...state.export,
          codeDialogOpen: action.payload,
        },
      }
    }

    case 'SET_HELP_DIALOG_OPEN': {
      return {
        ...state,
        export: {
          ...state.export,
          helpDialogOpen: action.payload,
        },
      }
    }

    case 'SET_THEME': {
      return {
        ...state,
        preferences: {
          ...state.preferences,
          theme: action.payload,
        },
      }
    }

    case 'UNDO': {
      const undoStack = state.history.undoStack
      if (undoStack.length === 0) return state
      const [previousSnapshot, ...remainingUndo] = undoStack
      if (!previousSnapshot) return state
      const currentSnapshot: CustomGroupTransaction = {
        groups: state.customGroups.groups,
        activeGroupIndex: state.customGroups.activeGroupIndex,
        description: previousSnapshot.description,
        notes: state.customGroups.notes,
        extensions: state.customGroups.extensions,
      }
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          groups: previousSnapshot.groups,
          activeGroupIndex: previousSnapshot.activeGroupIndex,
          notes: previousSnapshot.notes,
          extensions: previousSnapshot.extensions,
        },
        history: {
          undoStack: remainingUndo,
          redoStack: [currentSnapshot, ...state.history.redoStack].slice(0, HISTORY_CAPACITY),
        },
      }
    }

    case 'REDO': {
      const redoStack = state.history.redoStack
      if (redoStack.length === 0) return state
      const [nextSnapshot, ...remainingRedo] = redoStack
      if (!nextSnapshot) return state
      const currentSnapshot: CustomGroupTransaction = {
        groups: state.customGroups.groups,
        activeGroupIndex: state.customGroups.activeGroupIndex,
        description: nextSnapshot.description,
        notes: state.customGroups.notes,
        extensions: state.customGroups.extensions,
      }
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          groups: nextSnapshot.groups,
          activeGroupIndex: nextSnapshot.activeGroupIndex,
          notes: nextSnapshot.notes,
          extensions: nextSnapshot.extensions,
        },
        history: {
          undoStack: [currentSnapshot, ...state.history.undoStack].slice(0, HISTORY_CAPACITY),
          redoStack: remainingRedo,
        },
      }
    }

    default:
      return state
  }
}
