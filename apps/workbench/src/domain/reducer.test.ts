import { describe, expect, it } from 'vitest'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { workbenchReducer } from './reducer'
import { selectBatchSelectLabel, selectExportPacks } from './selectors'
import { initialWorkbenchState, type WorkbenchState } from './state'

const mockPacks: SmojiPack[] = [
  { id: 'pack-a', label: 'Pack A', items: [{ id: 'a1', label: 'A1', src: 'https://cdn.example/a1.webp' }, { id: 'a2', label: 'A2', src: 'https://cdn.example/a2.webp' }] },
  { id: 'pack-b', label: 'Pack B', items: [{ id: 'b1', label: 'B1', src: 'https://cdn.example/b1.webp' }] },
  { id: 'pack-c', label: 'Pack C', items: [{ id: 'c1', label: 'C1', src: 'https://cdn.example/c1.webp' }] },
  { id: 'pack-d', label: 'Pack D', items: [{ id: 'd1', label: 'D1', src: 'https://cdn.example/d1.webp' }] },
]

function stateWithCatalog(): WorkbenchState {
  return workbenchReducer(initialWorkbenchState, {
    type: 'SET_CATALOG_PACKS',
    payload: mockPacks,
  })
}

describe('workbenchReducer and selectors', () => {
  describe('Pack Selection & "全选 / 反选" contract', () => {
    it('selects all packs when none are selected, and updates label to 反选', () => {
      let state = stateWithCatalog()
      expect(state.packSelection.selectedPackIds.size).toBe(0)
      expect(selectBatchSelectLabel(state)).toBe('全选')

      // Click batch select: 0 selected => all selected
      state = workbenchReducer(state, { type: 'BATCH_SELECT_PACKS' })
      expect(state.packSelection.selectedPackIds.size).toBe(4)
      expect(state.packSelection.selectedPackIds.has('pack-a')).toBe(true)
      expect(state.packSelection.selectedPackIds.has('pack-b')).toBe(true)
      expect(state.packSelection.selectedPackIds.has('pack-c')).toBe(true)
      expect(state.packSelection.selectedPackIds.has('pack-d')).toBe(true)
      expect(selectBatchSelectLabel(state)).toBe('反选')

      // Click batch select again: all selected => 0 selected
      state = workbenchReducer(state, { type: 'BATCH_SELECT_PACKS' })
      expect(state.packSelection.selectedPackIds.size).toBe(0)
      expect(selectBatchSelectLabel(state)).toBe('全选')
    })

    it('implements partial invert: [A, C] -> [B, D] without clearing or all-selecting', () => {
      let state = stateWithCatalog()
      // Manually select pack-a and pack-c
      state = workbenchReducer(state, { type: 'TOGGLE_PACK_SELECTION', payload: 'pack-a' })
      state = workbenchReducer(state, { type: 'TOGGLE_PACK_SELECTION', payload: 'pack-c' })
      expect(Array.from(state.packSelection.selectedPackIds).sort()).toEqual(['pack-a', 'pack-c'])
      expect(selectBatchSelectLabel(state)).toBe('反选')

      // Click "反选"
      state = workbenchReducer(state, { type: 'BATCH_SELECT_PACKS' })
      expect(Array.from(state.packSelection.selectedPackIds).sort()).toEqual(['pack-b', 'pack-d'])
      expect(selectBatchSelectLabel(state)).toBe('反选')

      // Click "反选" again: [B, D] -> [A, C]
      state = workbenchReducer(state, { type: 'BATCH_SELECT_PACKS' })
      expect(Array.from(state.packSelection.selectedPackIds).sort()).toEqual(['pack-a', 'pack-c'])
      expect(selectBatchSelectLabel(state)).toBe('反选')
    })

    it('supports clear selection explicitly', () => {
      let state = stateWithCatalog()
      state = workbenchReducer(state, { type: 'SELECT_ALL_PACKS' })
      expect(state.packSelection.selectedPackIds.size).toBe(4)
      state = workbenchReducer(state, { type: 'CLEAR_PACK_SELECTION' })
      expect(state.packSelection.selectedPackIds.size).toBe(0)
      expect(selectBatchSelectLabel(state)).toBe('全选')
    })

    it('excludes and restores items within selected packs', () => {
      let state = stateWithCatalog()
      state = workbenchReducer(state, { type: 'SELECT_ALL_PACKS' })
      expect(selectExportPacks(state)[0]!.items).toHaveLength(2)

      state = workbenchReducer(state, { type: 'EXCLUDE_PACK_ITEM', payload: 'https://cdn.example/a1.webp' })
      expect(selectExportPacks(state)[0]!.items).toHaveLength(1)
      expect(selectExportPacks(state)[0]!.items[0]!.id).toBe('a2')

      state = workbenchReducer(state, { type: 'RESTORE_PACK_ITEM', payload: 'https://cdn.example/a1.webp' })
      expect(selectExportPacks(state)[0]!.items).toHaveLength(2)
    })
  })

  describe('Custom Groups & Undo/Redo transactions', () => {
    it('creates group and supports undo/redo', () => {
      let state = workbenchReducer(initialWorkbenchState, {
        type: 'CREATE_CUSTOM_GROUP',
        payload: { label: '我的收藏' },
      })
      expect(state.customGroups.groups).toHaveLength(1)
      expect(state.customGroups.groups[0]!.label).toBe('我的收藏')
      expect(state.history.undoStack).toHaveLength(1)

      // Undo creation
      state = workbenchReducer(state, { type: 'UNDO' })
      expect(state.customGroups.groups).toHaveLength(0)
      expect(state.history.redoStack).toHaveLength(1)

      // Redo creation
      state = workbenchReducer(state, { type: 'REDO' })
      expect(state.customGroups.groups).toHaveLength(1)
      expect(state.customGroups.groups[0]!.label).toBe('我的收藏')
    })

    it('merges groups and splits groups with full undo reversibility', () => {
      let state = stateWithCatalog()
      state = workbenchReducer(state, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '组1' } })
      state = workbenchReducer(state, { type: 'CREATE_CUSTOM_GROUP', payload: { label: '组2' } })
      const item1 = mockPacks[0]!.items[0]!
      const item2 = mockPacks[0]!.items[1]!
      state = workbenchReducer(state, { type: 'SET_ACTIVE_CUSTOM_GROUP', payload: 0 })
      state = workbenchReducer(state, { type: 'TOGGLE_CUSTOM_ITEM', payload: item1 })
      state = workbenchReducer(state, { type: 'SET_ACTIVE_CUSTOM_GROUP', payload: 1 })
      state = workbenchReducer(state, { type: 'TOGGLE_CUSTOM_ITEM', payload: item2 })

      expect(state.customGroups.groups).toHaveLength(2)
      expect(state.customGroups.groups[0]!.items).toHaveLength(1)
      expect(state.customGroups.groups[1]!.items).toHaveLength(1)

      // Merge 组2 into 组1
      state = workbenchReducer(state, { type: 'MERGE_CUSTOM_GROUP', payload: 1 })
      expect(state.customGroups.groups).toHaveLength(1)
      expect(state.customGroups.groups[0]!.items).toHaveLength(2)

      // Undo merge
      state = workbenchReducer(state, { type: 'UNDO' })
      expect(state.customGroups.groups).toHaveLength(2)
      expect(state.customGroups.groups[0]!.items).toHaveLength(1)
      expect(state.customGroups.groups[1]!.items).toHaveLength(1)

      // Split 组1 after merge redo
      state = workbenchReducer(state, { type: 'REDO' })
      expect(state.customGroups.groups).toHaveLength(1)
      state = workbenchReducer(state, { type: 'SPLIT_CUSTOM_GROUP', payload: 0 })
      expect(state.customGroups.groups).toHaveLength(2)
      expect(state.customGroups.groups[0]!.items).toHaveLength(1)
      expect(state.customGroups.groups[1]!.items).toHaveLength(1)
    })
  })
})
