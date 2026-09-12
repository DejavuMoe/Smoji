export interface SmojiItem {
  readonly id: string
  readonly label: string
  readonly src: string
}

export interface SmojiPack {
  readonly id: string
  readonly label: string
  readonly items: readonly SmojiItem[]
}

export interface SmojiManifest {
  readonly version: 1
  readonly packs: readonly SmojiPack[]
}

/** JSON input; parsing expands templates into SmojiManifest with required src. */
export type SmojiManifestInput = SmojiManifest | {
  readonly version: 1
  readonly base: string
  readonly packs: readonly {
    readonly id: string
    readonly label: string
    readonly items: readonly (Omit<SmojiItem, 'src'> & { readonly src?: string })[]
  }[]
}

export interface InsertTarget {
  insert(item: SmojiItem, pack: SmojiPack): void
}

export interface SmojiOptions {
  readonly trigger: HTMLElement
  readonly target: InsertTarget
  readonly packs: readonly SmojiPack[]
  readonly root?: HTMLElement
  readonly closeOnSelect?: boolean
  readonly onSelect?: (item: SmojiItem, pack: SmojiPack) => void
}

export interface SmojiPicker {
  open(): void
  close(): void
  toggle(): void
  isOpen(): boolean
  destroy(): void
}

export interface LoadSmojiOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export type SmojiSerialize = (item: SmojiItem, pack: SmojiPack) => string
