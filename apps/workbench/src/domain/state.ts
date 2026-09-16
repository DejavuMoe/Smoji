import type { SmojiItem, SmojiPack } from '../../../../packages/smoji/src/types'

export type WorkbenchMode = 'packs' | 'custom'
export type CopyFormat = 'md' | 'url' | 'hugo' | 'html' | 'bbcode'
export type PreviewBackground = 'transparent' | 'light' | 'dark'
export type PreviewScope = 'all' | 'selected' | 'current'
export type Theme = 'system' | 'light' | 'dark'
export type Density = 'compact' | 'comfortable'
export type GalleryView = 'source' | 'picked'

export interface EditableCustomPack {
  readonly id: string
  readonly label: string
  readonly items: readonly SmojiItem[]
}

/** Single shared result channel for custom-group transactions (success info or rejection). */
export interface CustomGroupNotice {
  readonly token: number
  readonly tone: 'error' | 'info'
  readonly message: string
}

export interface CustomGroupTransaction {
  readonly groups: readonly EditableCustomPack[]
  readonly activeGroupIndex: number
  readonly description: string
  /** Notes and extension bag travel with the snapshot so undo/redo restores the whole import. */
  readonly notes?: string
  readonly extensions?: Record<string, unknown>
}

export type CustomGroupExtensions = Record<string, unknown>

export interface WorkbenchState {
  readonly mode: WorkbenchMode

  readonly catalog: {
    readonly packs: readonly SmojiPack[]
    readonly activePackIndex: number
    readonly status: 'idle' | 'loading' | 'ready' | 'error'
    readonly error?: string
  }

  readonly packSelection: {
    readonly selectedPackIds: ReadonlySet<string>
    readonly excludedItemSrcs: ReadonlySet<string>
  }

  readonly customGroups: {
    readonly groups: readonly EditableCustomPack[]
    readonly activeGroupIndex: number
    readonly notes?: string
    /** Forward-compatible extension bag preserved across import/export/refresh. */
    readonly extensions?: CustomGroupExtensions
    readonly notice?: CustomGroupNotice | null
    readonly noticeSeq?: number
  }

  readonly gallery: {
    readonly view: GalleryView
    readonly density: Density
    readonly renderLimit: number
  }

  readonly inspector: {
    readonly selectedSrc: string | null
    readonly copyFormat: CopyFormat
    readonly previewBackground: PreviewBackground
  }

  readonly export: {
    readonly format: string
    readonly previewScope: PreviewScope
    readonly codeDialogOpen: boolean
    readonly helpDialogOpen: boolean
  }

  readonly preferences: {
    readonly theme: Theme
  }

  readonly history: {
    readonly undoStack: readonly CustomGroupTransaction[]
    readonly redoStack: readonly CustomGroupTransaction[]
  }
}

export const initialWorkbenchState: WorkbenchState = {
  mode: 'packs',
  catalog: {
    packs: [],
    activePackIndex: 0,
    status: 'idle',
  },
  packSelection: {
    selectedPackIds: new Set(),
    excludedItemSrcs: new Set(),
  },
  customGroups: {
    groups: [],
    activeGroupIndex: -1,
  },
  gallery: {
    view: 'source',
    density: 'compact',
    renderLimit: 72,
  },
  inspector: {
    selectedSrc: null,
    copyFormat: 'md',
    previewBackground: 'transparent',
  },
  export: {
    format: 'smoji',
    previewScope: 'selected',
    codeDialogOpen: false,
    helpDialogOpen: false,
  },
  preferences: {
    theme: 'system',
  },
  history: {
    undoStack: [],
    redoStack: [],
  },
}
