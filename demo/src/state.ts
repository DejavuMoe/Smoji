import type { SmojiItem, SmojiPack } from '../../packages/smoji/src/types'
import type { ExportTargetFormat } from './export'

export type WorkbenchMode = 'packs' | 'custom'
export type PreviewScope = 'active' | 'selected' | 'all'
export type ThemeMode = 'system' | 'light' | 'dark'
export type CopyFormat = 'md' | 'url' | 'html' | 'bbcode'

export interface EditableCustomPack {
  id: string
  label: string
  items: SmojiItem[]
  isExpanded?: boolean
}

export interface WorkbenchState {
  mode: WorkbenchMode
  activePack: number
  selectedPackIds: Set<string>
  excludedItemSrcs: Set<string>
  customPacks: EditableCustomPack[]
  activeCustomPackIndex: number
  previewScope: PreviewScope
  theme: ThemeMode
  comfortableDensity: boolean
  activeCopyFormat: CopyFormat
  currentCodeFormat: ExportTargetFormat
}

export type StateListener = <K extends keyof WorkbenchState>(
  key: K,
  value: WorkbenchState[K],
  prevState: Readonly<WorkbenchState>,
) => void

/**
 * Reactive Central State Store for Smoji Workbench.
 * Prevents scattered discrete global state variables and provides unified reactivity.
 */
export class WorkbenchStore {
  private state: WorkbenchState
  private listeners: Set<StateListener> = new Set()

  constructor(initialState?: Partial<WorkbenchState>) {
    this.state = {
      mode: 'packs',
      activePack: 0,
      selectedPackIds: new Set<string>(),
      excludedItemSrcs: new Set<string>(),
      customPacks: [],
      activeCustomPackIndex: -1,
      previewScope: 'active',
      theme: 'system',
      comfortableDensity: true,
      activeCopyFormat: 'md',
      currentCodeFormat: 'smoji',
      ...initialState,
    }
  }

  getState(): Readonly<WorkbenchState> {
    return this.state
  }

  get<K extends keyof WorkbenchState>(key: K): WorkbenchState[K] {
    return this.state[key]
  }

  set<K extends keyof WorkbenchState>(key: K, value: WorkbenchState[K]): void {
    const prev = { ...this.state }
    this.state[key] = value
    this.notify(key, value, prev)
  }

  update(patch: Partial<WorkbenchState>): void {
    const prev = { ...this.state }
    Object.assign(this.state, patch)
    for (const [key, value] of Object.entries(patch)) {
      this.notify(key as keyof WorkbenchState, value as WorkbenchState[keyof WorkbenchState], prev)
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify<K extends keyof WorkbenchState>(
    key: K,
    value: WorkbenchState[K],
    prev: Readonly<WorkbenchState>,
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(key, value, prev)
      } catch (err) {
        console.error('State listener error:', err)
      }
    }
  }
}
