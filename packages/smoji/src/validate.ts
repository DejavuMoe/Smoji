import type { SmojiItem, SmojiManifest, SmojiPack } from './types'

export const SMOJI_MANIFEST_MAX_BYTES = 1024 * 1024
export const SMOJI_MAX_PACKS = 64
export const SMOJI_MAX_ITEMS_PER_PACK = 600
export const SMOJI_MAX_ITEMS = 6000
export const SMOJI_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

const MANIFEST_KEYS = ['version', 'packs'] as const
const PACK_KEYS = ['id', 'label', 'items'] as const
const ITEM_KEYS = ['id', 'label', 'src'] as const

export class SmojiManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmojiManifestError'
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  if (keys.length !== expected.length) return false
  const sorted = expected.slice().sort()
  return sorted.every((key, index) => key === keys[index])
}

function isControlCodePoint(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
}

export function isValidSmojiLabel(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return false
  if (Array.from(trimmed).length > 40) return false
  for (const char of value) {
    const codePoint = char.codePointAt(0)!
    if (char === ']' || isControlCodePoint(codePoint)) return false
  }
  return true
}

export function assertManifestSize(text: string): void {
  if (text.length > SMOJI_MANIFEST_MAX_BYTES) {
    throw new SmojiManifestError('manifest-too-large')
  }
  if (new TextEncoder().encode(text).length > SMOJI_MANIFEST_MAX_BYTES) {
    throw new SmojiManifestError('manifest-too-large')
  }
}

export function resolveSmojiImageUrl(src: string, manifestUrl: string): string {
  let resolved: URL
  let origin: string
  try {
    resolved = new URL(src, manifestUrl)
    origin = new URL(manifestUrl).origin
  } catch {
    throw new SmojiManifestError('invalid-manifest')
  }
  if (
    resolved.origin !== origin
    || (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')
    || resolved.username
    || resolved.password
    || resolved.search
    || resolved.hash
  ) {
    throw new SmojiManifestError('invalid-manifest')
  }
  return resolved.href
}

export function parseSmojiManifest(value: unknown, manifestUrl: string): SmojiManifest {
  if (!value || typeof value !== 'object') throw new SmojiManifestError('invalid-manifest')
  const raw = value as Record<string, unknown>
  if (!hasExactKeys(raw, 'base' in raw ? ['version', 'base', 'packs'] : MANIFEST_KEYS) || raw.version !== 1 || !Array.isArray(raw.packs)) {
    throw new SmojiManifestError('invalid-manifest')
  }
  if (raw.packs.length < 1 || raw.packs.length > SMOJI_MAX_PACKS) {
    throw new SmojiManifestError('invalid-manifest')
  }

  if ('base' in raw) {
    if (typeof raw.base !== 'string' || !raw.base.includes('{pack}') || !raw.base.includes('{id}')) throw new SmojiManifestError('invalid-manifest')
    const sample = raw.base.split('{pack}').join('pack').split('{id}').join('item')
    if (/[{}]/.test(sample)) throw new SmojiManifestError('invalid-manifest')
    resolveSmojiImageUrl(sample, manifestUrl)
  }
  let itemCount = 0
  const packIds = new Set<string>()
  const packs: SmojiPack[] = raw.packs.map((pack): SmojiPack => {
    if (!pack || typeof pack !== 'object') throw new SmojiManifestError('invalid-manifest')
    const source = pack as Record<string, unknown>
    if (
      !hasExactKeys(source, PACK_KEYS)
      || typeof source.id !== 'string'
      || !SMOJI_ID_PATTERN.test(source.id)
      || packIds.has(source.id)
      || !isValidSmojiLabel(source.label)
      || !Array.isArray(source.items)
      || source.items.length < 1
      || source.items.length > SMOJI_MAX_ITEMS_PER_PACK
    ) {
      throw new SmojiManifestError('invalid-manifest')
    }
    packIds.add(source.id)

    const itemIds = new Set<string>()
    const items: SmojiItem[] = source.items.map((item): SmojiItem => {
      if (!item || typeof item !== 'object') throw new SmojiManifestError('invalid-manifest')
      const entry = item as Record<string, unknown>
      if (
        !hasExactKeys(entry, 'src' in entry ? ITEM_KEYS : ['id', 'label'])
        || typeof entry.id !== 'string'
        || !SMOJI_ID_PATTERN.test(entry.id)
        || itemIds.has(entry.id)
        || !isValidSmojiLabel(entry.label)
        || ('src' in entry ? typeof entry.src !== 'string' : typeof raw.base !== 'string')
      ) {
        throw new SmojiManifestError('invalid-manifest')
      }
      itemIds.add(entry.id)
      itemCount += 1
      if (itemCount > SMOJI_MAX_ITEMS) throw new SmojiManifestError('invalid-manifest')
      return {
        id: entry.id,
        label: entry.label.trim(),
        src: resolveSmojiImageUrl(typeof entry.src === 'string' ? entry.src : (raw.base as string).split('{pack}').join(source.id as string).split('{id}').join(entry.id), manifestUrl),
      }
    })

    return {
      id: source.id,
      label: source.label.trim(),
      items,
    }
  })

  return { version: 1, packs }
}
