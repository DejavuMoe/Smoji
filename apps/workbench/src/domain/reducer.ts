import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import type { WorkbenchAction } from './actions'
import {
  HISTORY_CAPACITY,
  SMOJI_MAX_ITEMS,
  SMOJI_MAX_ITEMS_PER_PACK,
  SMOJI_MAX_PACKS,
} from './limits'
import type { CustomGroupTransaction, EditableCustomPack, WorkbenchState } from './state'

function generateGroupId(existingGroups: readonly EditableCustomPack[], base: string = 'custom'): string {
  const cleanBase = base.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16) || 'group'
  let id = cleanBase
  let counter = 1
  const existing = new Set(existingGroups.map((g) => g.id))
  while (existing.has(id)) {
    id = `${cleanBase}-${counter++}`
  }
  return id
}

function commitTransaction(
  state: WorkbenchState,
  description: string,
  nextGroups: readonly EditableCustomPack[],
  nextActiveIndex: number,
): WorkbenchState {
  const currentSnapshot: CustomGroupTransaction = {
    groups: state.customGroups.groups,
    activeGroupIndex: state.customGroups.activeGroupIndex,
    description,
  }
  const nextUndo = [currentSnapshot, ...state.history.undoStack].slice(0, HISTORY_CAPACITY)
  return {
    ...state,
    customGroups: {
      ...state.customGroups,
      groups: nextGroups,
      activeGroupIndex: nextActiveIndex,
    },
    history: {
      undoStack: nextUndo,
      redoStack: [],
    },
  }
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
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) return state
      const label = action.payload.label.trim()
      if (!label) return state
      const id = action.payload.id || generateGroupId(state.customGroups.groups, label)
      const newGroup: EditableCustomPack = { id, label, items: [] }
      const nextGroups = [...state.customGroups.groups, newGroup]
      const nextActiveIndex = nextGroups.length - 1
      return commitTransaction(state, `创建分组「${label}」`, nextGroups, nextActiveIndex)
    }

    case 'RENAME_CUSTOM_GROUP': {
      const { index, label } = action.payload
      const trimmed = label.trim()
      if (!trimmed || index < 0 || index >= state.customGroups.groups.length) return state
      const target = state.customGroups.groups[index]!
      if (target.label === trimmed) return state
      const nextGroups = state.customGroups.groups.map((g, i) =>
        i === index ? { ...g, label: trimmed } : g,
      )
      return commitTransaction(state, `重命名分组「${trimmed}」`, nextGroups, state.customGroups.activeGroupIndex)
    }

    case 'DELETE_CUSTOM_GROUP': {
      const index = action.payload
      if (index < 0 || index >= state.customGroups.groups.length) return state
      const target = state.customGroups.groups[index]!
      const nextGroups = state.customGroups.groups.filter((_, i) => i !== index)
      let nextActiveIndex = state.customGroups.activeGroupIndex
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
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) return state
      const source = state.customGroups.groups[index]!
      const label = `${source.label} (副本)`
      const id = generateGroupId(state.customGroups.groups, source.id)
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
        if (!seen.has(item.src) && combined.length < SMOJI_MAX_ITEMS_PER_PACK) {
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
      if (state.customGroups.groups.length >= SMOJI_MAX_PACKS) return state
      const target = state.customGroups.groups[index]!
      if (target.items.length < 2) return state
      const half = Math.ceil(target.items.length / 2)
      const firstItems = target.items.slice(0, half)
      const secondItems = target.items.slice(half)
      const first: EditableCustomPack = { ...target, items: firstItems }
      const secondLabel = `${target.label} (2)`
      const secondId = generateGroupId(state.customGroups.groups, `${target.id}-split`)
      const second: EditableCustomPack = { id: secondId, label: secondLabel, items: secondItems }
      const groups = [...state.customGroups.groups]
      groups.splice(index, 1, first, second)
      return commitTransaction(state, `拆分分组「${target.label}」`, groups, index)
    }

    case 'TOGGLE_CUSTOM_ITEM': {
      const item = action.payload
      const activeIndex = state.customGroups.activeGroupIndex
      let groups = [...state.customGroups.groups]
      let targetIndex = activeIndex

      // Auto-create default group if none exists
      if (groups.length === 0) {
        const defaultGroup: EditableCustomPack = { id: 'favorites', label: '常用', items: [] }
        groups = [defaultGroup]
        targetIndex = 0
      } else if (targetIndex < 0 || targetIndex >= groups.length) {
        targetIndex = 0
      }

      const currentGroup = groups[targetIndex]!
      const existsIndex = currentGroup.items.findIndex((i) => i.src === item.src)

      if (existsIndex !== -1) {
        // Remove item
        const nextItems = currentGroup.items.filter((_, i) => i !== existsIndex)
        groups[targetIndex] = { ...currentGroup, items: nextItems }
        return commitTransaction(state, `移出表情「${item.label}」`, groups, targetIndex)
      } else {
        // Add item if group not full
        if (currentGroup.items.length >= SMOJI_MAX_ITEMS_PER_PACK) return state
        const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0)
        if (totalItems >= SMOJI_MAX_ITEMS) return state
        const nextItems = [...currentGroup.items, item]
        groups[targetIndex] = { ...currentGroup, items: nextItems }
        return commitTransaction(state, `添加表情「${item.label}」`, groups, targetIndex)
      }
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
      return commitTransaction(state, `移出表情「${removed.label}」`, nextGroups, state.customGroups.activeGroupIndex)
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
      const { itemSrc, targetGroupIndex } = action.payload
      if (targetGroupIndex < 0 || targetGroupIndex >= state.customGroups.groups.length) return state
      const targetGroup = state.customGroups.groups[targetGroupIndex]!
      if (targetGroup.items.some((i) => i.src === itemSrc)) return state
      if (targetGroup.items.length >= SMOJI_MAX_ITEMS_PER_PACK) return state

      // Find item in catalog or any group
      let foundItem: SmojiItem | undefined
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
      if (!foundItem) return state

      const nextGroups = state.customGroups.groups.map((g, i) =>
        i === targetGroupIndex ? { ...g, items: [...g.items, foundItem!] } : g,
      )
      return commitTransaction(
        state,
        `移动表情到「${targetGroup.label}」`,
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
      let totalItems = groups.reduce((acc, g) => acc + g.items.length, 0)

      for (const item of currentPack.items) {
        if (
          !seen.has(item.src) &&
          !state.packSelection.excludedItemSrcs.has(item.src) &&
          targetGroup.items.length + added.length < SMOJI_MAX_ITEMS_PER_PACK &&
          totalItems + added.length < SMOJI_MAX_ITEMS
        ) {
          added.push(item)
          seen.add(item.src)
        }
      }
      if (added.length === 0) return state

      groups[targetIndex] = { ...targetGroup, items: [...targetGroup.items, ...added] }
      return commitTransaction(
        state,
        `批量添加「${currentPack.label}」到「${targetGroup.label}」`,
        groups,
        targetIndex,
      )
    }

    case 'IMPORT_CUSTOM_GROUPS': {
      const imported = action.payload
      if (imported.length === 0) return state
      const nextGroups = [...state.customGroups.groups]
      for (const group of imported) {
        if (nextGroups.length >= SMOJI_MAX_PACKS) break
        const id = generateGroupId(nextGroups, group.id)
        nextGroups.push({ ...group, id })
      }
      const nextActive = state.customGroups.activeGroupIndex >= 0 ? state.customGroups.activeGroupIndex : 0
      return commitTransaction(state, '导入分组配置', nextGroups, nextActive)
    }

    case 'CLEAR_ALL_CUSTOM_GROUPS': {
      if (state.customGroups.groups.length === 0) return state
      return commitTransaction(state, '清空所有自选分组', [], -1)
    }

    case 'SET_CUSTOM_NOTES': {
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          notes: action.payload,
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
      if (items.length <= 1) return state
      const currentIndex = items.findIndex((i) => i.src === selectedSrc)
      if (currentIndex === -1) return state

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
      }
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          groups: previousSnapshot.groups,
          activeGroupIndex: previousSnapshot.activeGroupIndex,
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
      }
      return {
        ...state,
        customGroups: {
          ...state.customGroups,
          groups: nextSnapshot.groups,
          activeGroupIndex: nextSnapshot.activeGroupIndex,
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
