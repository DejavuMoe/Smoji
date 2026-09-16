import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'
import type {
  CopyFormat,
  CustomGroupExtensions,
  Density,
  EditableCustomPack,
  GalleryView,
  PreviewBackground,
  PreviewScope,
  Theme,
  WorkbenchMode,
} from './state'

export type WorkbenchAction =
  | { type: 'SET_MODE'; payload: WorkbenchMode }
  | { type: 'SET_CATALOG_PACKS'; payload: readonly SmojiPack[] }
  | { type: 'SET_CATALOG_STATUS'; payload: { status: 'idle' | 'loading' | 'ready' | 'error'; error?: string } }
  | { type: 'SET_ACTIVE_PACK'; payload: number }
  | { type: 'TOGGLE_PACK_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_PACKS' }
  | { type: 'INVERT_PACK_SELECTION' }
  | { type: 'BATCH_SELECT_PACKS' }
  | { type: 'CLEAR_PACK_SELECTION' }
  | { type: 'EXCLUDE_PACK_ITEM'; payload: string }
  | { type: 'RESTORE_PACK_ITEM'; payload: string }
  | { type: 'TOGGLE_PACK_ITEM_EXCLUSION'; payload: string }
  | { type: 'EXCLUDE_CURRENT_PACK_ALL' }
  | { type: 'RESTORE_CURRENT_PACK_ALL' }
  | { type: 'SET_CUSTOM_GROUPS'; payload: { groups: readonly EditableCustomPack[]; activeGroupIndex?: number } }
  | { type: 'SET_ACTIVE_CUSTOM_GROUP'; payload: number }
  | { type: 'CREATE_CUSTOM_GROUP'; payload: { label: string; id?: string } }
  | { type: 'RENAME_CUSTOM_GROUP'; payload: { index: number; label: string } }
  | { type: 'SET_CUSTOM_GROUP_ID'; payload: { index: number; id: string } }
  | { type: 'DELETE_CUSTOM_GROUP'; payload: number }
  | { type: 'REORDER_CUSTOM_GROUPS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'MOVE_CUSTOM_GROUP'; payload: { index: number; direction: -1 | 1 } }
  | { type: 'DUPLICATE_CUSTOM_GROUP'; payload: number }
  | { type: 'MERGE_CUSTOM_GROUP'; payload: number }
  | { type: 'SPLIT_CUSTOM_GROUP'; payload: number }
  | { type: 'TOGGLE_CUSTOM_ITEM'; payload: SmojiItem }
  | { type: 'TOGGLE_CUSTOM_ITEM_IN_GROUP'; payload: { item: SmojiItem; groupIndex: number } }
  | { type: 'REMOVE_CUSTOM_ITEM'; payload: { groupIndex: number; itemIndex: number } }
  | { type: 'REORDER_CUSTOM_ITEMS'; payload: { groupIndex: number; fromIndex: number; toIndex: number } }
  | {
      type: 'MOVE_CUSTOM_ITEM_TO_GROUP'
      payload: { itemSrc: string; targetGroupIndex: number; sourceGroupIndex?: number; sourceItemIndex?: number }
    }
  | { type: 'ADD_ALL_CURRENT_PACK_TO_CUSTOM' }
  | {
      type: 'IMPORT_CUSTOM_GROUPS'
      payload: { groups: readonly EditableCustomPack[]; notes?: string; extensions?: CustomGroupExtensions }
    }
  | { type: 'CLEAR_ALL_CUSTOM_GROUPS' }
  | { type: 'SET_CUSTOM_NOTES'; payload: string }
  | { type: 'SET_CUSTOM_EXTENSIONS'; payload: CustomGroupExtensions }
  | { type: 'CLEAR_CUSTOM_GROUP_NOTICE' }
  | { type: 'SET_GALLERY_VIEW'; payload: GalleryView }
  | { type: 'SET_GALLERY_DENSITY'; payload: Density }
  | { type: 'EXPAND_RENDER_LIMIT' }
  | { type: 'OPEN_INSPECTOR'; payload: string }
  | { type: 'CLOSE_INSPECTOR' }
  | { type: 'NAVIGATE_INSPECTOR'; payload: 'prev' | 'next' }
  | { type: 'SET_INSPECTOR_COPY_FORMAT'; payload: CopyFormat }
  | { type: 'SET_INSPECTOR_BG'; payload: PreviewBackground }
  | { type: 'SET_EXPORT_FORMAT'; payload: string }
  | { type: 'SET_EXPORT_PREVIEW_SCOPE'; payload: PreviewScope }
  | { type: 'SET_CODE_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_HELP_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'UNDO' }
  | { type: 'REDO' }
