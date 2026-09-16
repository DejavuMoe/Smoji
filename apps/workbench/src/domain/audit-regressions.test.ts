import { expect, it } from 'vitest'
import { SMOJI_ID_PATTERN, isValidSmojiLabel } from '../../../../packages/smoji/src/validate'
import { workbenchReducer } from './reducer'
import { initialWorkbenchState, type EditableCustomPack, type WorkbenchState } from './state'

const items = Array.from({ length: 601 }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}`, src: `https://example.test/${i}.png` }))
const group = (id: string, count: number): EditableCustomPack => ({ id, label: id, items: items.slice(0, count) })

function expectRejected(before: WorkbenchState, action: Parameters<typeof workbenchReducer>[1]): WorkbenchState {
  const after = workbenchReducer(before, action)
  expect(after.customGroups.groups).toBe(before.customGroups.groups)
  expect(after.history.undoStack).toBe(before.history.undoStack)
  expect(after.customGroups.notice?.tone).toBe('error')
  return after
}

it('rejects oversized merge/import/duplicate/drop atomically without losing items or adding history', () => {
  const state: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [group('a', 600), { ...group('b', 0), items: [items[600]!] }], activeGroupIndex: 1 } }
  expectRejected(state, { type: 'MERGE_CUSTOM_GROUP', payload: 1 })

  const full: WorkbenchState = { ...state, customGroups: { groups: Array.from({ length: 10 }, (_, i) => group(`group-${i}`, 600)), activeGroupIndex: 0 } }
  expectRejected(full, { type: 'DUPLICATE_CUSTOM_GROUP', payload: 0 })
  expectRejected(full, { type: 'IMPORT_CUSTOM_GROUPS', payload: { groups: [group('extra', 1)] } })
  const withEmpty: WorkbenchState = { ...full, customGroups: { ...full.customGroups, groups: [...full.customGroups.groups, group('empty', 0)] } }
  expectRejected(withEmpty, { type: 'MOVE_CUSTOM_ITEM_TO_GROUP', payload: { itemSrc: items[0]!.src, targetGroupIndex: 10 } })
  const many: WorkbenchState = { ...state, customGroups: { groups: Array.from({ length: 63 }, (_, i) => group(`group-${i}`, 0)), activeGroupIndex: 0 } }
  expectRejected(many, { type: 'IMPORT_CUSTOM_GROUPS', payload: { groups: [group('x', 0), group('y', 0)] } })
})

it('keeps the active group identity when deleting an earlier group', () => {
  const state: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [group('a', 1), group('b', 1), group('c', 1)], activeGroupIndex: 1 } }
  const next = workbenchReducer(state, { type: 'DELETE_CUSTOM_GROUP', payload: 0 })
  expect(next.customGroups.groups[next.customGroups.activeGroupIndex]!.id).toBe('b')
  expect(workbenchReducer(next, { type: 'UNDO' }).customGroups.groups).toEqual(state.customGroups.groups)
})

// A01 · creation/edit validation matches the restore-time validator
it('rejects labels and IDs the restore validator would drop, and never generates an invalid ID', () => {
  const empty: WorkbenchState = { ...initialWorkbenchState }
  expectRejected(empty, { type: 'CREATE_CUSTOM_GROUP', payload: { label: 'x'.repeat(41) } })
  expectRejected(empty, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '坏]名称' } })
  expectRejected(empty, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '合法', id: '-bad' } })

  const shortLabel = workbenchReducer(empty, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '-' } })
  expect(shortLabel.customGroups.groups).toHaveLength(1)
  expect(SMOJI_ID_PATTERN.test(shortLabel.customGroups.groups[0]!.id)).toBe(true)

  const created = workbenchReducer(empty, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '常用', id: 'Team_A.v1' } })
  expect(created.customGroups.groups[0]!.id).toBe('Team_A.v1')
  expectRejected(created, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '重复', id: 'Team_A.v1' } })
  expectRejected(created, { type: 'RENAME_CUSTOM_GROUP', payload: { index: 0, label: 'y'.repeat(41) } })
  expectRejected(created, { type: 'SET_CUSTOM_GROUP_ID', payload: { index: 0, id: '_invalid' } })
})

it('keeps derived duplicate/split names inside the label limit', () => {
  const longLabel = 'a'.repeat(40)
  const source = group('seed', 2)
  const state: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [{ ...source, label: longLabel }], activeGroupIndex: 0 } }
  const duplicated = workbenchReducer(state, { type: 'DUPLICATE_CUSTOM_GROUP', payload: 0 })
  expect(isValidSmojiLabel(duplicated.customGroups.groups[1]!.label)).toBe(true)
  const split = workbenchReducer(state, { type: 'SPLIT_CUSTOM_GROUP', payload: 0 })
  expect(isValidSmojiLabel(split.customGroups.groups[1]!.label)).toBe(true)
})

// A03 · import keeps valid, non-conflicting IDs verbatim
it('preserves valid imported group IDs and only renames real conflicts', () => {
  const state: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [group('taken', 0)], activeGroupIndex: 0 } }
  const next = workbenchReducer(state, {
    type: 'IMPORT_CUSTOM_GROUPS',
    payload: { groups: [group('Team_A.v1', 1), group('taken', 1)] },
  })
  expect(next.customGroups.groups.map((g) => g.id)).toEqual(['taken', 'Team_A.v1', 'taken-1'])
  expect(next.customGroups.notice?.message).toContain('1 个 ID 冲突')
})

// A04 · notes and unknown extensions import as one transaction and undo restores them
it('imports groups, notes and extensions as one undoable transaction', () => {
  const state: WorkbenchState = {
    ...initialWorkbenchState,
    customGroups: { groups: [group('a', 1)], activeGroupIndex: 0, notes: '旧备注', extensions: { 'vendor.old': 1 } },
  }
  const imported = workbenchReducer(state, {
    type: 'IMPORT_CUSTOM_GROUPS',
    payload: {
      groups: [group('b', 1)],
      notes: '新备注',
      extensions: { 'vendor.new': 2, 'smoji.workbench': { notes: '新备注' } },
    },
  })
  expect(imported.customGroups.notes).toBe('新备注')
  expect(imported.customGroups.extensions).toEqual({ 'vendor.old': 1, 'vendor.new': 2, 'smoji.workbench': { notes: '新备注' } })
  const undone = workbenchReducer(imported, { type: 'UNDO' })
  expect(undone.customGroups.notes).toBe('旧备注')
  expect(undone.customGroups.extensions).toEqual({ 'vendor.old': 1 })
  const redone = workbenchReducer(undone, { type: 'REDO' })
  expect(redone.customGroups.notes).toBe('新备注')
  expect(redone.customGroups.groups.map((g) => g.id)).toEqual(['a', 'b'])
})

// A05 · tray drag between groups moves, never copies
it('moves a tray item between groups and refuses when the target is full or already has it', () => {
  const a = { id: 'a', label: 'a', items: [items[0]!, items[1]!] }
  const b: EditableCustomPack = { id: 'b', label: 'b', items: [] }
  const state: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [a, b], activeGroupIndex: 0 } }
  const moved = workbenchReducer(state, {
    type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
    payload: { itemSrc: items[0]!.src, targetGroupIndex: 1, sourceGroupIndex: 0, sourceItemIndex: 0 },
  })
  expect(moved.customGroups.groups[0]!.items.map((i) => i.src)).toEqual([items[1]!.src])
  expect(moved.customGroups.groups[1]!.items.map((i) => i.src)).toEqual([items[0]!.src])

  const duplicated = workbenchReducer(moved, {
    type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
    payload: { itemSrc: items[0]!.src, targetGroupIndex: 1, sourceGroupIndex: 0, sourceItemIndex: 0 },
  })
  expect(duplicated.customGroups.groups).toBe(moved.customGroups.groups)
  expect(duplicated.customGroups.notice?.tone).toBe('error')

  const fullTarget: WorkbenchState = {
    ...state,
    customGroups: {
      groups: [a, { id: 'full', label: 'full', items: Array.from({ length: 600 }, (_, i) => ({ id: `f-${i}`, label: `f-${i}`, src: `https://example.test/f-${i}.png` })) }],
      activeGroupIndex: 0,
    },
  }
  expectRejected(fullTarget, {
    type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
    payload: { itemSrc: items[0]!.src, targetGroupIndex: 1, sourceGroupIndex: 0, sourceItemIndex: 0 },
  })

  // Gallery drops carry no source group: they are copies.
  const copied = workbenchReducer(state, {
    type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
    payload: { itemSrc: items[0]!.src, targetGroupIndex: 1 },
  })
  expect(copied.customGroups.groups[0]!.items).toHaveLength(2)
  expect(copied.customGroups.groups[1]!.items).toHaveLength(1)
})

// A06 · custom-mode batch add ignores pack exclusions
it('adds every item of the current pack in custom mode regardless of pack exclusions', () => {
  const pack = { id: 'p', label: 'p', items: [items[0]!, items[1]!] }
  const state: WorkbenchState = {
    ...initialWorkbenchState,
    catalog: { packs: [pack], activePackIndex: 0, status: 'ready' },
    packSelection: { selectedPackIds: new Set(), excludedItemSrcs: new Set([items[0]!.src]) },
    mode: 'custom',
    customGroups: { groups: [group('a', 0)], activeGroupIndex: 0 },
  }
  const next = workbenchReducer(state, { type: 'ADD_ALL_CURRENT_PACK_TO_CUSTOM' })
  expect(next.customGroups.groups[0]!.items.map((i) => i.src)).toEqual([items[0]!.src, items[1]!.src])
})

// A12 · removing the inspected item keeps paging usable
it('moves the inspector to a neighbor after removing the selected item', () => {
  const a: EditableCustomPack = { id: 'a', label: 'a', items: [items[0]!, items[1]!] }
  const state: WorkbenchState = {
    ...initialWorkbenchState,
    mode: 'custom',
    gallery: { ...initialWorkbenchState.gallery, view: 'picked' },
    customGroups: { groups: [a], activeGroupIndex: 0 },
    inspector: { ...initialWorkbenchState.inspector, selectedSrc: items[0]!.src },
  }
  const afterRemove = workbenchReducer(state, { type: 'REMOVE_CUSTOM_ITEM', payload: { groupIndex: 0, itemIndex: 0 } })
  expect(afterRemove.inspector.selectedSrc).toBe(items[1]!.src)
  const afterLastRemove = workbenchReducer(afterRemove, { type: 'REMOVE_CUSTOM_ITEM', payload: { groupIndex: 0, itemIndex: 0 } })
  expect(afterLastRemove.inspector.selectedSrc).toBeNull()

  const stale: WorkbenchState = { ...state, inspector: { ...state.inspector, selectedSrc: 'https://example.test/missing.png' } }
  const navigated = workbenchReducer(stale, { type: 'NAVIGATE_INSPECTOR', payload: 'next' })
  expect(navigated.inspector.selectedSrc).toBe(items[0]!.src)
})

it('keeps source-gallery previews open when toggling group membership', () => {
  const state: WorkbenchState = {
    ...initialWorkbenchState,
    mode: 'custom',
    customGroups: { groups: [{ id: 'a', label: 'a', items: [items[0]!] }], activeGroupIndex: 0 },
    inspector: { ...initialWorkbenchState.inspector, selectedSrc: items[0]!.src },
  }
  const removed = workbenchReducer(state, { type: 'TOGGLE_CUSTOM_ITEM', payload: items[0]! })
  expect(removed.customGroups.groups[0]!.items).toHaveLength(0)
  expect(removed.inspector.selectedSrc).toBe(items[0]!.src)
  const restored = workbenchReducer(removed, { type: 'TOGGLE_CUSTOM_ITEM', payload: items[0]! })
  expect(restored.customGroups.groups[0]!.items).toHaveLength(1)
  expect(restored.inspector.selectedSrc).toBe(items[0]!.src)
  const otherGroup: WorkbenchState = {
    ...state,
    gallery: { ...state.gallery, view: 'picked' },
    customGroups: { ...state.customGroups, groups: [...state.customGroups.groups, { id: 'b', label: 'b', items: [items[0]!] }] },
  }
  expect(workbenchReducer(otherGroup, { type: 'REMOVE_CUSTOM_ITEM', payload: { groupIndex: 1, itemIndex: 0 } }).inspector.selectedSrc).toBe(items[0]!.src)
})

// A14 · capacity rejection is observable, not silent
it('reports capacity rejections instead of silently clearing forms', () => {
  const full: WorkbenchState = {
    ...initialWorkbenchState,
    customGroups: { groups: Array.from({ length: 64 }, (_, i) => group(`group-${i}`, 0)), activeGroupIndex: 0 },
  }
  expectRejected(full, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '再来一个' } })
  expectRejected(full, { type: 'DUPLICATE_CUSTOM_GROUP', payload: 0 })
  expectRejected(full, { type: 'SPLIT_CUSTOM_GROUP', payload: 0 })

  const single: WorkbenchState = { ...initialWorkbenchState, customGroups: { groups: [group('a', 600)], activeGroupIndex: 0 } }
  const rejectedToggle = expectRejected(single, { type: 'TOGGLE_CUSTOM_ITEM', payload: items[600]! })
  expect(rejectedToggle.customGroups.notice?.message).toContain('600')
})
