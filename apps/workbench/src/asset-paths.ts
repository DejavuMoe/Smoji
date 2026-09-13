import manifest from '../../../data/smoji.json'
const assetPaths = new Set(manifest.packs.flatMap((pack) => pack.items.map((item) => item.src.replace(/^\.\//, ''))))
import type { SmojiPack } from 'smoji'

let paths: Record<string, string> = {}
export async function loadAssetAliases(): Promise<void> {
  paths = (await import('../../../data/published-aliases.json')).default
}

/** Resolve only known published paths on the current asset origin and base directory. */
export function canonicalAssetSrc(src: string, manifestUrl: string): string {
  try {
    const base = new URL('./', manifestUrl)
    const url = new URL(src, base)
    const site = new URL(import.meta.env.BASE_URL, window.location.href)
    const sourceBase = url.origin === base.origin ? base : site
    if (url.origin !== sourceBase.origin || !url.pathname.startsWith(sourceBase.pathname) || url.search || url.hash || url.username || url.password) return src
    const path = decodeURIComponent(url.pathname.slice(sourceBase.pathname.length))
    const replacement = paths[path] ?? (assetPaths.has(path) ? path : undefined)
    return replacement ? new URL(replacement, base).href : src
  } catch {
    return src
  }
}

export function canonicalPackIds(id: string): string[] {
  const migrated = new Set(Object.entries(paths)
    .filter(([from]) => from.startsWith(`${id}/`))
    .map(([, to]) => to.split('/')[0]!))
  return migrated.size ? [...migrated] : [id]
}

/** Preserve selected sub-pack contents when several old folders become one category. */
export function migratePackSelection(
  selected: Set<string>,
  excluded: Set<string>,
  packs: readonly SmojiPack[],
  manifestUrl: string,
): void {
  const current = new Map(packs.map((pack) => [pack.id, pack]))
  const oldIds = new Set([...selected].filter((id) => !current.has(id)))
  const included = new Map<string, Set<string>>()
  for (const [from, to] of Object.entries(paths)) {
    if (!oldIds.has(from.split('/')[0]!)) continue
    const target = to.split('/')[0]!
    if (!current.has(target) || selected.has(target)) continue
    if (!included.has(target)) included.set(target, new Set())
    included.get(target)!.add(new URL(to, manifestUrl).href)
  }
  oldIds.forEach((id) => selected.delete(id))
  for (const [id, sources] of included) {
    selected.add(id)
    for (const item of current.get(id)!.items) {
      if (!sources.has(item.src)) excluded.add(item.src)
    }
  }
}
